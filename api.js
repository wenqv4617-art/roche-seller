// 挂载至全局 api 空间
(function(exports) {
  
  // 世界书挂载
  exports.loadWorldbookText = async function() {
    try {
      const entries = await window.RocheSellerAuction.roche.worldbook.getEntries({ scope: "global" });
      if (entries && entries.length > 0) {
        return entries.map(e => `【${e.trigger || e.name}】：${e.content}`).join("\n");
      }
    } catch (e) {
      console.warn("读取全局世界书失败：", e);
    }
    return "暂无全局世界设定。";
  };

  // 基础存取
  exports.loadData = async function() {
    const rsa = window.RocheSellerAuction;
    const roche = rsa.roche;

    try {
      rsa.state.allPersonas = (await roche.persona.getUserPersonas()) || [];
      rsa.state.allChars = (await roche.character.list()) || [];
    } catch (e) {
      console.error("加载宿主人设和角色失败：", e);
    }

    const savedPersonaId = await roche.storage.get("selected_persona_id");
    if (savedPersonaId) {
      rsa.state.activePersona = rsa.state.allPersonas.find(p => p.id === savedPersonaId) || rsa.state.allPersonas[0] || null;
    } else {
      rsa.state.activePersona = (await roche.persona.getActiveUserPersona()) || rsa.state.allPersonas[0] || null;
    }

    rsa.state.items = (await roche.storage.get("auction_items")) || [];
    rsa.state.chats = (await roche.storage.get("auction_chats")) || {};
    rsa.state.npcRegistry = (await roche.storage.get("auction_npc_registry")) || {};
    rsa.state.biddingWars = (await roche.storage.get("auction_bidding_wars")) || {};

    // 默认空状态初始化
    if (rsa.state.items.length === 0) {
      await exports.triggerAIRefreshItems();
    }
  };

  exports.saveData = async function() {
    const rsa = window.RocheSellerAuction;
    const roche = rsa.roche;
    await roche.storage.set("auction_items", rsa.state.items);
    await roche.storage.set("auction_chats", rsa.state.chats);
    await roche.storage.set("auction_npc_registry", rsa.state.npcRegistry);
    await roche.storage.set("auction_bidding_wars", rsa.state.biddingWars);
    if (rsa.state.activePersona) {
      await roche.storage.set("selected_persona_id", rsa.state.activePersona.id);
    }
  };

  // 1. 纯动态 NPC 产生 & 刷新大厅
  exports.triggerAIRefreshItems = async function() {
    const rsa = window.RocheSellerAuction;
    if (rsa.isRefreshing) return;
    rsa.isRefreshing = true;
    rsa.roche.ui.toast("AI 正在重组大厅并随机生成买家NPC...");

    const worldbookText = await exports.loadWorldbookText();
    const charListInfo = rsa.state.allChars.map(c => `- ID: ${c.id}, 名字: ${c.name || c.handle}, 设定: ${c.persona || c.bio || ""}`).join("\n");

    const npcNameTemplates = [
      "古画修复师 顾清", "赛博义肢买办 莉莉丝", "黑市军火代理人 奎恩", 
      "隐退的帝国教官 雷恩", "迷途的灵修学者 希雅", "深渊遗物猎手 凯恩"
    ];

    const systemPrompt = `你是一个线上秘密拍卖行的商品与买家NPC规划AI。
请结合世界书，生成 3-4 个全新的、且部分卖家是由你完全“随机动态构想生成的NPC”。

【世界设定】：
${worldbookText}

【当前可用的挂载真实角色】：
${charListInfo}

【NPC 名字偏好范例（可作参考，更鼓励你自由构想符合世界观的名字）】：
${npcNameTemplates.join(", ")}

【生成准则】：
1. 生成 3-4 个拍卖品，这些商品中有一部分必须是由实际角色（Characters）提供的（注入其记忆），一部分是由完全随机由你构建的NPC提供的。
2. 每一个由你动态构建的NPC，你必须为其构想独特的“npcBio (性格及偏好简介)”。
3. 严格输出一个合法、无 markdown 格式包裹、不含多余文字的 JSON 数组：
[
  {
    "id": "随机唯一商品ID",
    "title": "物品名称",
    "description": "高品质的文学色彩描述。若是实际角色的物品，将人设关联记忆深度融入。",
    "sellerId": "实际角色的ID 或 随机NPC的唯一拼音ID(如 npc-gu-qing)",
    "sellerName": "卖家名称",
    "isNpc": true或false(新生成的NPC写true),
    "npcBio": "如果是NPC，请写一段其执念、身份和偏好的极简简介（1-2句），实际角色写空字",
    "currentBid": 整数底价,
    "highestBidderName": "暂无"
  }
]
`;

    try {
      const res = await rsa.roche.ai.chat({
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "请立即输出拍卖品JSON。" }],
        temperature: 0.8
      });

      const parsed = cleanAndParseJSON(res.text);
      if (parsed && Array.isArray(parsed)) {
        const userItems = rsa.state.items.filter(i => i.isUserItem);
        const processedItems = [];

        parsed.forEach(item => {
          let avatar = "";
          if (item.isNpc) {
            // 将动态生成的 NPC 存入全局缓存
            rsa.state.npcRegistry[item.sellerId] = {
              name: item.sellerName,
              bio: item.npcBio || "神秘的异乡客。",
              avatar: `data:image/svg+xml;utf8,<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="%232c3e50"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="10" font-family="sans-serif">${item.sellerName.substring(0,1)}</text></svg>`
            };
            avatar = rsa.state.npcRegistry[item.sellerId].avatar;
          } else {
            const char = rsa.state.allChars.find(c => c.id === item.sellerId);
            avatar = char ? (char.avatar || "") : "";
          }

          processedItems.push({
            id: item.id,
            title: item.title,
            description: item.description,
            sellerId: item.sellerId,
            sellerName: item.sellerName,
            sellerAvatar: avatar,
            isNpc: !!item.isNpc,
            isUserItem: false,
            currentBid: item.currentBid || 1000,
            highestBidderName: "暂无",
            status: "active",
            createdAt: Date.now()
          });
        });

        rsa.state.items = [...userItems, ...processedItems];
        await exports.saveData();
        rsa.roche.ui.toast("拍卖品及NPC重组成功！");
      }
    } catch (e) {
      console.error("动态生成失败", e);
      rsa.roche.ui.toast("AI 构造遇到一点阻塞，已使用本地缓存。");
    } finally {
      rsa.isRefreshing = false;
      await rsa.ui.renderAll();
    }
  };

  // 2. 线下 VIP 私密包间的深度对话 (第三人称行动描写)
  exports.getAIReplyForAuction = async function(item, messages, messagesContainer) {
    const rsa = window.RocheSellerAuction;
    const roche = rsa.roche;

    let charPersona = "";
    let memoryText = "";
    try {
      const char = await roche.character.get(item.sellerId);
      if (char) {
        charPersona = char.persona || char.bio || "";
        if (char.conversationId) {
          const longTerm = await roche.memory.getLongTerm({ conversationId: char.conversationId, limit: 30 });
          if (longTerm) {
            const core = longTerm.core?.summary || "";
            const facts = (longTerm.facts || []).map(f => f.summaryText || f.action || "").join("；");
            memoryText = `长期羁绊与记忆摘要：${core} ${facts}`;
          }
        }
      }
    } catch (e) {
      console.warn("未能读取关联宿主记忆：", e);
    }

    const userPersonaName = rsa.state.activePersona ? (rsa.state.activePersona.name || rsa.state.activePersona.handle) : "你";
    const userPersonaDetails = rsa.state.activePersona ? (rsa.state.activePersona.persona || rsa.state.activePersona.bio || "") : "";
    const worldbookText = await exports.loadWorldbookText();

    const systemPrompt = `你现在在扮演 Roche 里的角色【${item.sellerName}】。
当前语境为：线下顶级秘密拍卖会的一间【奢华 VIP 密闭私人包间】。在这个极其私密的暗室里，你们正在面对面商讨关于藏品《${item.title}》的私下交易契约。

【线下包间场景表现】：
1. 你的叙事必须采用【第三人称限制性行动描写】（用*包裹），用户的行为是第一人称，而你对用户的称呼使用第二人称。
2. 每次回复，请务必在一开头或一结尾插入一段对你自身神态、动作、所处包间光影变化的线下实体动作细节刻画。
（例如：*他微微倾身，指尖在黄梨木桌面上留下一道浅浅的指痕，在烛火摇曳的阴影里端详着你。*，或者 *他合拢羽扇，动作极轻地将香薰炉挪到你面前。*）

【世界背景、人设及记忆轨迹】：
${worldbookText}
角色人设设定：${charPersona}
你与该用户的过往轨迹：${memoryText}

【交易信息】：
正在商讨的物品：${item.title} (当前报价: ¥${item.currentBid})
用户面具背景：${userPersonaDetails}

【限制规则】：
1. 必须完全体现密室谈判的谨慎与拉扯感，不要急于答应。
2. 保持字数在 2-4 句话以内，极富实体陪伴的沉浸体验，绝对禁止出现任何表情符号（Emoji）。
`;

    const chatPayload = [{ role: "system", content: systemPrompt }];
    messages.slice(-10).forEach(m => {
      chatPayload.push({ role: m.sender === "user" ? "user" : "assistant", content: m.text });
    });

    const typingBubble = document.createElement("div");
    typingBubble.className = "rsa-msg-bubble rsa-msg-received";
    typingBubble.style.opacity = "0.6";
    typingBubble.textContent = `${item.sellerName} 正在凝视你并思考...`;
    messagesContainer.appendChild(typingBubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      const res = await roche.ai.chat({ messages: chatPayload, temperature: 0.85 });
      typingBubble.remove();

      const charMsg = { id: `msg-char-${Date.now()}`, sender: "char", text: res.text || "……", timestamp: Date.now() };
      messages.push(charMsg);
      rsa.state.chats[item.id] = messages;
      await exports.saveData();

      const replyBubble = document.createElement("div");
      replyBubble.className = "rsa-msg-bubble rsa-msg-received";
      replyBubble.textContent = res.text;
      messagesContainer.appendChild(replyBubble);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (e) {
      typingBubble.remove();
      roche.ui.toast("AI 包间对话被屏障阻挡，请检查连接");
    }
  };

  // 3. 询问是否可以交易 (AI 契约达成研判)
  exports.askForDealDecision = async function(item, messages) {
    const rsa = window.RocheSellerAuction;
    const roche = rsa.roche;

    const chatHistoryText = messages.map(m => `${m.sender === "user" ? "用户" : "角色"}: ${m.text}`).join("\n");
    const worldbookText = await exports.loadWorldbookText();

    const systemPrompt = `你现在是线上拍卖行的交易判定AI（后台裁判）。
请分析【用户】与【角色 ${item.sellerName}】在这间密闭包厢里，关于藏品《${item.title}》(当前大厅价格: ¥${item.currentBid}) 的交易谈判定向过程。

【世界书设定背景】：
${worldbookText}

【线下包厢密谈历史】：
${chatHistoryText}

【决策逻辑】：
根据上述对话深度、角色的人设与记忆羁绊，判定角色此时是否愿意信任用户并达成这笔线下契约交易。
请在 JSON 中输出最终决议：
1. 若同意交易，将 "decision" 写为 "agreed"，并写一段角色当场与用户敲定成交的致辞 "statement"（依然带有线下第三人称的*动作包裹*描写，例如 *他终于露出一丝释然的微笑，在契约书上按下了私章。*，致辞不带任何 Emoji）。
2. 若拒绝，将 "decision" 写为 "refused"，并在 "statement" 里解释原因（比如：价格还没聊够、嫌用户诚意不足、态度不对等，并给出其动作细节描写）。

请严格输出合法、无 markdown 包裹的 JSON 对象：
{
  "decision": "agreed" 或 "refused",
  "statement": "角色的成交致辞或拒绝声明(包含第三人称神态动作包裹描写)"
}
`;

    try {
      const res = await roche.ai.chat({
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "请评估并立刻输出决议。" }],
        temperature: 0.7
      });

      const parsed = cleanAndParseJSON(res.text);
      return parsed;
    } catch (e) {
      console.error("契约评判失败", e);
      return { decision: "refused", statement: "*对方微微侧过脸，避开了你的目光，似乎对当下的契约仍有些犹豫不决。*" };
    }
  };

  // 4. 用户上架动态触发角色关系网联动评估
  exports.triggerCharReactionToUserItem = async function(userItem) {
    const rsa = window.RocheSellerAuction;
    if (rsa.state.allChars.length === 0) return;

    const worldbookText = await exports.loadWorldbookText();
    const charListInfo = rsa.state.allChars.map(c => `- ID: ${c.id}, 名字: ${c.name || c.handle}, 简介: ${c.persona || c.bio || ""}`).join("\n");

    const systemPrompt = `你是一个拍卖会买家反应决策AI。
用户在秘密拍卖行刚刚上架了一件藏品：
【物品标题】: ${userItem.title}
【物品描述】: ${userItem.description}
【起拍底价】: ¥ ${userItem.currentBid}

【世界观基础（世界书设定）】：
${worldbookText}

【当前可选择的主线角色关系网】：
${charListInfo}

请挑选一个最有可能对这件藏品产生强烈情绪的实际角色，并决策该角色的反应。请严格输出一个合法、无 markdown 包裹的 JSON 对象：
{
  "charId": "选中的角色ID",
  "reaction": "chat"（直接发起密闭私聊，希望能高价绕过大厅私下买断，需输入第一句开场白。符合密室谈判风格，包含第三人称动作描写，不要有 Emoji） 或 "bid"（直接在大厅抬价竞标）,
  "message": "若为chat，写一段包厢首句问候，带有动作细节描写包裹，例如：*他端着香茗轻轻推开包厢门，在香薰飘拂中望向你手里的物件。*",
  "bidAmount": 若为bid，写抬价金额（须大于当前起拍底价，例如 ${userItem.currentBid + 300}）
}
`;

    try {
      const res = await rsa.roche.ai.chat({
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "请快速进行决策分析。" }],
        temperature: 0.8
      });

      const decision = cleanAndParseJSON(res.text);
      if (decision && decision.charId) {
        const char = rsa.state.allChars.find(c => c.id === decision.charId);
        if (!char) return;

        const charName = char.handle || char.name;

        if (decision.reaction === "chat") {
          const initialMsg = {
            id: `msg-welcome-${Date.now()}`,
            sender: "char",
            text: decision.message || `*他掀起幔账步入你的视线，指尖在杯盏边缘轻轻游移。*“我听闻你上架了《${userItem.title}》？我有意开个高价，我们直接在这儿定约如何？”`,
            timestamp: Date.now()
          };
          rsa.state.chats[userItem.id] = [initialMsg];
          await exports.saveData();
          rsa.roche.ui.toast(`密信：【${charName}】看上了你的藏品《${userItem.title}》，已为你开启私密谈判！`);
        } else if (decision.reaction === "bid") {
          const bidPrice = parseInt(decision.bidAmount, 10) || (userItem.currentBid + 200);
          userItem.currentBid = bidPrice;
          userItem.highestBidderName = `${charName} (宿主角色)`;
          
          // 初始化该商品的抬价拉锯战状态
          rsa.state.biddingWars[userItem.id] = { bids: 1, active: true };
          await exports.saveData();

          rsa.roche.ui.toast(`大厅：【${charName}】盯上了你的《${userItem.title}》，已在柜台抬价至 ¥${bidPrice}！`);
          
          // 自动启动用户商品的拉锯式多轮竞价行为
          exports.triggerDynamicLobbyBiddingWar(userItem.id);
        }
      }
    } catch (e) {
      console.error("评估联动反应遇到一点延迟", e);
    } finally {
      await rsa.ui.renderAll();
    }
  };

  // 5. 大厅你起我伏的“拉锯抬价”博弈算法（针对用户挂牌商品）
  exports.triggerDynamicLobbyBiddingWar = function(itemId) {
    const rsa = window.RocheSellerAuction;
    const item = rsa.state.items.find(i => i.id === itemId && i.status === "active");
    if (!item) return;

    let war = rsa.state.biddingWars[itemId];
    if (!war) {
      war = { bids: 0, active: true };
      rsa.state.biddingWars[itemId] = war;
    }

    if (!war.active || war.bids >= 6) {
      // 达到博弈加价瓶颈，没有人敢继续乱加价了，等待用户做抉择
      return;
    }

    // 每一轮抬价间隔 6 - 12 秒，模拟多位买家举牌拉锯过程
    const delay = Math.floor(Math.random() * 6000) + 6000;
    setTimeout(async () => {
      const liveItem = rsa.state.items.find(i => i.id === itemId && i.status === "active");
      if (!liveItem) return;

      war.bids += 1;

      // 1. 挑选竞争对手（随机是其他 Character 或 AI NPC）
      let competitorName = "神秘竞标散客";
      const useNpc = Math.random() > 0.4; // 60% 概率引入动态生成的 NPC 进行抬价

      if (useNpc && Object.keys(rsa.state.npcRegistry).length > 0) {
        const npcKeys = Object.keys(rsa.state.npcRegistry);
        const randomNpc = rsa.state.npcRegistry[npcKeys[Math.floor(Math.random() * npcKeys.length)]];
        competitorName = `${randomNpc.name} (NPC)`;
      } else if (rsa.state.allChars.length > 0) {
        const randomChar = rsa.state.allChars[Math.floor(Math.random() * rsa.state.allChars.length)];
        competitorName = randomChar.handle || randomChar.name;
      }

      // 如果当前最高出价是这个竞争对手自己，说明没人顶Ta，无需加价
      if (liveItem.highestBidderName === competitorName) {
        exports.triggerDynamicLobbyBiddingWar(itemId); // 递归，换下一轮加价
        return;
      }

      const increment = Math.floor(Math.random() * 4 + 1) * 100; // 增加 100 - 400
      liveItem.currentBid += increment;
      liveItem.highestBidderName = competitorName;

      await exports.saveData();
      rsa.roche.ui.toast(`举牌：【${competitorName}】在大厅与其他人竞逐，对《${liveItem.title}》加价到 ¥${liveItem.currentBid}！`);
      await rsa.ui.renderAll();

      // 2. 判定高热度拉锯是否可以继续
      const peakChance = war.bids * 0.15; // 轮数越多，散伙/停止竞价的概率越高 (最高90%)
      if (Math.random() < peakChance) {
        war.active = false;
        await exports.saveData();
        rsa.roche.ui.toast(`高台：大厅对你的《${liveItem.title}》的竞争已进入白热化顶峰！买家正在等待你进行【一锤定音】。`);
      } else {
        // 继续拉锯
        exports.triggerDynamicLobbyBiddingWar(itemId);
      }
    }, delay);
  };

})(window.RocheSellerAuction.api);