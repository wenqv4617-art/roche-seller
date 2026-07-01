// ==================== AI 智能生成与决策层 ====================
(function(exports) {
  // 安全获取全局共享空间
  const rsa = window.RocheSellerAuction;

  // 托底预设 NPC 库
  const _backupNpcs = [
    { id: "npc-gu-qing", name: "顾清", bio: "古画修复师，能从斑驳墨迹中感知时光执念。", initials: "顾" },
    { id: "npc-quinn", name: "奎恩", bio: "荒原拾荒人，专注于寻找旧时代机械废墟里的精密遗物。", initials: "奎" },
    { id: "npc-lilith", name: "莉莉丝", bio: "赛博义肢买办，偏好微缩齿轮和电磁能量块。", initials: "莉" },
    { id: "npc-reyn", name: "雷恩", bio: "帝国旧教官，醉心于冷兵器与古战场秘辛。", initials: "雷" },
    { id: "npc-shiya", name: "希雅", bio: "迷途的灵修学者，致力于解析精神共鸣与灵魂本质。", initials: "希" }
  ];

  // 契约世界书挂载
  exports.loadWorldbookText = async function() {
    try {
      const entries = await rsa.roche.worldbook.getEntries({ scope: "global" });
      if (entries && entries.length > 0) {
        return entries.map(e => `【${e.trigger || e.name}】：${e.content}`).join("\n");
      }
    } catch (e) {
      console.warn("读取全局世界书失败：", e);
    }
    return "暂无全局世界设定。";
  };

  // 数据载入与老版本结构自动兼容迁移
  exports.loadData = async function() {
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

    // 平滑迁移：将老版本的 [Message] 数组转换为含有对手标记的新结构，避免旧缓存崩溃
    Object.keys(rsa.state.chats).forEach(itemId => {
      const chatData = rsa.state.chats[itemId];
      if (Array.isArray(chatData)) {
        const item = rsa.state.items.find(i => i.id === itemId);
        rsa.state.chats[itemId] = {
          opponentId: item ? item.sellerId : "unknown",
          messages: chatData
        };
      }
    });

    if (rsa.state.items.length === 0) {
      await exports.triggerAIRefreshItems();
    }
  };

  exports.saveData = async function() {
    const roche = rsa.roche;
    await roche.storage.set("auction_items", rsa.state.items);
    await roche.storage.set("auction_chats", rsa.state.chats);
    await roche.storage.set("auction_npc_registry", rsa.state.npcRegistry);
    await roche.storage.set("auction_bidding_wars", rsa.state.biddingWars);
    if (rsa.state.activePersona) {
      await roche.storage.set("selected_persona_id", rsa.state.activePersona.id);
    }
  };

  // 生成大厅竞价账本
  function generateBiddingHistory(title, basePrice) {
    const bidderA = _backupNpcs[Math.floor(Math.random() * _backupNpcs.length)].name + " (NPC)";
    const bidderB = _backupNpcs[Math.floor(Math.random() * _backupNpcs.length)].name + " (NPC)";
    return [
      { bidderName: "委托底价挂牌", amount: basePrice - 500, time: "30分钟前" },
      { bidderName: bidderA, amount: basePrice - 200, time: "15分钟前" },
      { bidderName: bidderB, amount: basePrice, time: "最新出价" }
    ];
  }

  // 默认托底藏品
  function generateDefaultItems() {
    const defaultItems = [];
    if (rsa.state.allChars && rsa.state.allChars.length > 0) {
      rsa.state.allChars.forEach((char, index) => {
        const charName = char.name || char.handle || "神秘客";
        const currentBid = 1500;
        defaultItems.push({
          id: `item-char-${char.id}-${index}`,
          title: `${charName}随身携带的旧挂饰`,
          description: `带有${charName}过往故事的古朴小挂饰。在阳光下折射出淡淡的铜锈色，似乎包含一段宿主未曾得知的温暖回忆。`,
          sellerId: char.id,
          sellerName: charName,
          sellerAvatar: char.avatar || "",
          isNpc: false,
          isUserItem: false,
          currentBid: currentBid,
          highestBidderName: "系统保留",
          bidHistory: generateBiddingHistory(`${charName}的旧挂饰`, currentBid),
          status: "active",
          createdAt: Date.now() - (index * 3600000)
        });
      });
    }

    _backupNpcs.forEach((npc, idx) => {
      const npcKey = `${npc.id}-${idx}`;
      rsa.state.npcRegistry[npcKey] = {
        name: npc.name,
        bio: npc.bio,
        avatar: createNpcAvatar(npc.initials)
      };

      const currentBid = 2800 + (idx * 300);
      defaultItems.push({
        id: `item-npc-${npc.id}-${idx}`,
        title: idx === 0 ? "未被解译的纯黑手抄本" : (idx === 1 ? "精密黑盒遗物" : "发光的深海晶核"),
        description: idx === 0 ? "一部纸页完全泛黑的怪诞书籍，上面的符号不属于任何已知的人类文明语系。" : (idx === 1 ? "布满齿轮纹路的秘银铁盒，靠近时能隐约听到内部精密的齿轮卡扣转动声。" : "散发着淡蓝色微光的奇特矿晶，捧在手心能感受到类似潮汐波动的微弱脉搏。"),
        sellerId: npcKey,
        sellerName: npc.name,
        sellerAvatar: rsa.state.npcRegistry[npcKey].avatar,
        isNpc: true,
        isUserItem: false,
        currentBid: currentBid,
        highestBidderName: npc.name,
        bidHistory: generateBiddingHistory("预设NPC藏品", currentBid),
        status: "active",
        createdAt: Date.now()
      });
    });

    return defaultItems;
  }

  // AI 刷新商品大厅
  exports.triggerAIRefreshItems = async function() {
    if (rsa.isRefreshing) return;
    rsa.isRefreshing = true;
    rsa.roche.ui.toast("AI 正在重组大厅并随机生成买家NPC...");

    const worldbookText = await exports.loadWorldbookText();
    const charListInfo = rsa.state.allChars.map(c => `- ID: ${c.id}, 名字: ${c.name || c.handle}, 设定: ${c.persona || c.bio || ""}`).join("\n");
    const npcNameTemplates = _backupNpcs.map(n => `${n.name} (${n.bio})`).join("、");

    const systemPrompt = `你是一个线上秘密拍卖行的商品与买家NPC规划AI。
请结合世界书，生成 3-4 个全新的、且部分卖家是由你完全“随机动态构想生成的NPC”。

【世界设定】：
${worldbookText}

【当前可用的挂载真实角色】：
${charListInfo}

【NPC 名字与身份偏好参考】：
${npcNameTemplates}

【生成准则】：
1. 生成 3-4 个拍卖品，这些商品中有一部分必须是由实际角色（Characters）提供的，一部分是由完全随机由你构建的NPC提供的。
2. 每一个由你动态构建的NPC，你必须为其构想独特的“npcBio”。
3. 请严格输出一个合法、无 markdown 格式包裹、不含多余文字的 JSON 数组：
[
  {
    "id": "随机唯一商品ID",
    "title": "物品名称",
    "description": "高品质描述。若是实际角色的物品，将人设关联记忆深度融入。",
    "sellerId": "实际角色的ID 或 随机NPC的唯一拼音ID(如 npc-gu-qing)",
    "sellerName": "卖家名称（中文名字或设定）",
    "isNpc": true或false(系统NPC为true),
    "npcBio": "如果是NPC，请写其偏好和执念简介，实际角色写空字",
    "currentBid": 整数起拍价,
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
          let sellerId = item.sellerId || "";
          let sellerName = item.sellerName || "";
          let npcBio = item.npcBio || "";
          let isNpc = !!item.isNpc || sellerId.startsWith("npc-");
          const currentBid = item.currentBid || 1000;

          if (isNpc) {
            if (!sellerId || !sellerName || !sellerId.startsWith("npc-")) {
              const fallbackNpc = _backupNpcs[Math.floor(Math.random() * _backupNpcs.length)];
              sellerId = `${fallbackNpc.id}-${Math.floor(Math.random() * 1000)}`;
              sellerName = fallbackNpc.name;
              npcBio = fallbackNpc.bio;
            }

            const initialLetter = sellerName.substring(0, 1) || "N";
            rsa.state.npcRegistry[sellerId] = {
              name: sellerName,
              bio: npcBio || "神秘的竞买常客。",
              avatar: createNpcAvatar(initialLetter)
            };
            avatar = rsa.state.npcRegistry[sellerId].avatar;
          } else {
            const char = rsa.state.allChars.find(c => c.id === sellerId);
            avatar = char ? (char.avatar || "") : "";
          }

          processedItems.push({
            id: item.id || `item-gen-${Date.now()}-${Math.random()}`,
            title: item.title || "奇特的拍卖品",
            description: item.description || "在暗处微微闪光的神秘物品。",
            sellerId: sellerId,
            sellerName: sellerName,
            sellerAvatar: avatar,
            isNpc: isNpc,
            isUserItem: false,
            currentBid: currentBid,
            highestBidderName: "暂无",
            status: "active",
            createdAt: Date.now(),
            // 自动配置大厅抬价历史
            bidsHistory: [
              { bidder: "起拍价", price: currentBid - 500 },
              { bidder: sellerName, price: currentBid }
            ]
          });
        });

        rsa.state.items = [...userItems, ...processedItems];
        await exports.saveData();
        rsa.roche.ui.toast("拍卖品及NPC重组成功！");
      } else {
        throw new Error("AI 生成的数据未能转换为标准数组。");
      }
    } catch (e) {
      console.error("AI生成彻底失败：", e);
      const errorMsg = e.message || String(e);
      rsa.roche.ui.toast(`AI 刷新失败: ${errorMsg.substring(0, 90)} (已为您执行预设托底)`);
      
      const userItems = rsa.state.items.filter(i => i.isUserItem);
      rsa.state.items = [...userItems, ...generateDefaultItems()];
      await exports.saveData();
    } finally {
      rsa.isRefreshing = false;
      await rsa.ui.renderAll();
    }
  };

  // 7. 线下 VIP 私密包厢对话 (微型小说文体 + 铁律：禁止代替 User 回答或行动)
  exports.getAIReplyForAuction = async function(item, messages, messagesContainer) {
    const roche = rsa.roche;

    // 核心安全：判断到底是谁找谁谈判
    // 如果这个藏品是用户自己上架的，聊天对话的主体是那个出价/私聊用户的 Character，所以应该读 item.highestBidder (或 chats 里第一条记录对应的卖家)
    let talkerId = item.sellerId;
    let talkerName = item.sellerName;

    if (item.isUserItem) {
      // 寻找发起对话的主线角色
      const history = rsa.state.chats[item.id] || [];
      const firstCharMsg = history.find(m => m.sender === "char");
      // 如果没有主线角色，兜底选择第一个主线角色
      const matchedChar = rsa.state.allChars.find(c => firstMsgContainsCharName(initialTextOf(history), c) || c.id === item.sellerId);
      if (matchedChar) {
        talkerId = matchedChar.id;
        talkerName = matchedChar.handle || randomChar.name;
      }
    }

    let charPersona = "";
    let memoryText = "";
    try {
      const char = await roche.character.get(item.isUserItem ? getChatPartnerId(item) : item.sellerId);
      if (char) {
        charPersona = char.persona || char.bio || "";
        if (char.conversationId) {
          const longTerm = await roche.memory.getLongTerm({ conversationId: char.conversationId, limit: 30 });
          if (longTerm) {
            const core = longTerm.core?.summary || "";
            const facts = (longTerm.facts || []).map(f => f.summaryText || f.action || "").join("；");
            memoryText = `你与 Ta 的历史羁绊摘要：${core} ${facts}`;
          }
        }
      }
    } catch (e) {
      console.warn("未能读取关联宿主记忆：", e);
    }

    const userPersonaName = rsa.state.activePersona ? (rsa.state.activePersona.name || rsa.state.activePersona.handle) : "你";
    const userPersonaDetails = rsa.state.activePersona ? (rsa.state.activePersona.persona || rsa.state.activePersona.bio || "") : "";
    const worldbookText = await exports.loadWorldbookText();

    const systemPrompt = `你现在在小说体裁中，扮演正在秘密拍卖会线下 VIP 独立包间里的角色【${item.isUserItem ? "买家" : "卖家"}：${item.sellerName}】。你正在与用户面对面商讨《${item.title}》的交易。

【小说文体 & 行为限制（铁律）】：
1. 你的叙事必须完全采用【第三人称（他/她/角色名字）】的微型小说动作细节描写，且所有的动作描写必须使用 * 符号进行包裹。你的台词使用正常的冒号与双引号。
（例如：*他微微侧过身去，目光在烛火暗处晃动了一下，语气带着一丝漫不经心。*“有些东西，不是用单纯的筹码能够度量的。”）
2. 【铁律：严禁替用户（User）行动或替User回答】！你绝对禁止在你的叙事中代表用户做出任何肢体动作、神态变化、台词表达、内心独白。你只负责且仅能描述你扮演的角色本人。用户想说什么、想做什么，完全由用户通过输入框发送过来的文本决定。
3. 请将你的动作白描描写和台词进行有机融合，富有真实线下密室谈判的博弈紧绷感。

【世界设定与记忆交集】：
${worldbookText}
你的人设设定：${charPersona}
你与Ta的记忆轨迹：${memoryText}

【谈判藏品上下文】：
物品名称：${item.title} (大厅竞拍价: ¥${item.currentBid})
用户目前的身份背景：${userPersonaDetails}
对用户的称呼：第二人称（你/您）。
`;

    const chatPayload = [{ role: "system", content: systemPrompt }];
    messages.slice(-10).forEach(m => {
      chatPayload.push({ role: m.sender === "user" ? "user" : "assistant", content: m.text });
    });

    const typingBubble = document.createElement("div");
    typingBubble.className = "rsa-msg-bubble rsa-msg-received";
    typingBubble.style.opacity = "0.6";
    typingBubble.textContent = `${item.isUserItem ? "对方" : item.sellerName} 正在低首思量...`;
    messagesContainer.appendChild(typingBubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      const res = await roche.ai.chat({ messages: chatPayload, temperature: 0.85 });
      typingBubble.remove();

      const replyText = res.text || "……";
      const charMsg = { id: `msg-char-${Date.now()}`, sender: "char", text: replyText, timestamp: Date.now() };
      messages.push(charMsg);
      rsa.state.chats[item.id].messages = messages;
      await exports.saveData();

      const replyBubble = document.createElement("div");
      replyBubble.className = "rsa-msg-bubble rsa-msg-received";
      replyBubble.textContent = replyText;
      messagesContainer.appendChild(replyBubble);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (e) {
      typingBubble.remove();
      roche.ui.toast(`AI 谈判连接被阻隔: ${e.message || e}`);
    }
  };

  // 9. 询问是否可以交易 (实体博弈小说判定 + 彻底禁止代替 User 代答)
  exports.askForDealDecision = async function(item, messages) {
    const roche = rsa.roche;
    const chatHistoryText = messages.map(m => `${m.sender === "user" ? "用户" : "角色"}: ${m.text}`).join("\n");
    const worldbookText = await exports.loadWorldbookText();

    const systemPrompt = `你现在是线上拍卖行的交易判定AI（后台裁判）。
请分析【用户】与【角色 ${item.sellerName}】在这间密闭包厢里，关于藏品《${item.title}》(当前大厅价格: ¥${item.currentBid}) 的交易谈判定向过程。

【世界书设定背景】：
${worldbookText}

【线下密室谈判历史】：
${chatHistoryText}

【决策逻辑】：
分析对话进度和两人的诚意，输出一个 JSON 对象：
1. "decision": "agreed"（同意成交）或 "refused"（拒绝成交）。
2. "statement": 角色做出的最终成交致辞或拒绝声明。风格要像写实小说里的实体白描交谈，【唯一禁令：绝不许抢话，绝不代替 User 做出任何举动、言语或内心戏描写】。

不带任何 Emoji，严格输出以下 JSON：
{
  "decision": "agreed" 或 "refused",
  "statement": "小说文体致辞（不许替User行动）"
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
      console.error("契约评判失败：", e);
      return { decision: "refused", statement: `*对方在烛光摇曳中微微垂下眼睑，轻轻转动着手中的墨笔，对当下的契约仍有些拿捏不定。* (判定异常: ${e.message})` };
    }
  };

  // 10. 用户上架动态触发角色关系网联动评估
  exports.triggerCharReactionToUserItem = async function(userItem) {
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
  "reaction": "chat"（直接发起密闭私聊，希望能高价绕过大厅私下买断，需输入第一句开场白。符合密室谈判小说风格，包含第三人称动作描写，不要有 Emoji，绝不代替User行动） 或 "bid"（直接在大厅抬价竞标）,
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
            text: decision.message || `*他掀起幔账步入你的包间隔断，在光影摇曳中向你望过来。*“听闻大厅里《${userItem.title}》正在挂拍？与其去柜台喧闹，不如我们在这儿直接私下签个买断，如何？”`,
            timestamp: Date.now()
          };
          
          // 核心安全：明确记录发起谈判的对手 CharID，彻底防止人称混淆
          rsa.state.chats[userItem.id] = {
            opponentId: decision.charId,
            messages: [initialMsg]
          };
          await exports.saveData();
          rsa.roche.ui.toast(`密信：【${charName}】看上了你的藏品《${userItem.title}》，已主动进入包厢找你谈判！`);
        } else if (decision.reaction === "bid") {
          const bidPrice = parseInt(decision.bidAmount, 10) || (userItem.currentBid + 200);
          userItem.currentBid = bidPrice;
          userItem.highestBidderName = `${charName} (宿主角色)`;
          
          rsa.state.biddingWars[userItem.id] = { bids: 1, active: true };
          await exports.saveData();

          rsa.roche.ui.toast(`大厅：【${charName}】盯上了你的《${userItem.title}》，已在柜台抬价至 ¥${bidPrice}！`);
          exports.triggerDynamicLobbyBiddingWar(userItem.id);
        }
      }
    } catch (e) {
      console.error("评估意向反应延迟：", e);
    } finally {
      await rsa.ui.renderAll();
    }
  };

  // 11. 大厅“拉锯抬价”竞争
  exports.triggerDynamicLobbyBiddingWar = function(itemId) {
    const item = rsa.state.items.find(i => i.id === itemId && i.status === "active");
    if (!item) return;

    let war = rsa.state.biddingWars[itemId];
    if (!war) {
      war = { bids: 0, active: true };
      rsa.state.biddingWars[itemId] = war;
    }

    if (!war.active || war.bids >= 6) {
      return;
    }

    const delay = Math.floor(Math.random() * 4000) + 4000;
    setTimeout(async () => {
      const liveItem = rsa.state.items.find(i => i.id === itemId && i.status === "active");
      if (!liveItem) return;

      war.bids += 1;

      let competitorName = "神秘竞标散客";
      const useNpc = Math.random() > 0.4;

      if (useNpc && Object.keys(rsa.state.npcRegistry).length > 0) {
        const npcKeys = Object.keys(rsa.state.npcRegistry);
        const randomNpc = rsa.state.npcRegistry[npcKeys[Math.floor(Math.random() * npcKeys.length)]];
        competitorName = `${randomNpc.name} (NPC)`;
      } else if (rsa.state.allChars.length > 0) {
        const randomChar = rsa.state.allChars[Math.floor(Math.random() * rsa.state.allChars.length)];
        competitorName = randomChar.handle || randomChar.name;
      }

      if (liveItem.highestBidderName === competitorName) {
        exports.triggerDynamicLobbyBiddingWar(itemId);
        return;
      }

      const increment = Math.floor(Math.random() * 4 + 1) * 100;
      liveItem.currentBid += increment;
      liveItem.highestBidderName = competitorName;

      // 同步添加竞标历史
      if (!liveItem.bidHistory) {
        liveItem.bidHistory = [];
      }
      liveItem.bidHistory.push({
        bidderName: competitorName,
        amount: liveItem.currentBid,
        time: "最新"
      });

      await exports.saveData();
      rsa.roche.ui.toast(`举牌：【${competitorName}】在大厅与其他人竞逐，对《${liveItem.title}》加价到 ¥${liveItem.currentBid}！`);
      await rsa.ui.renderAll();

      const peakChance = war.bids * 0.15;
      if (Math.random() < peakChance) {
        war.active = false;
        await exports.saveData();
        rsa.roche.ui.toast(`高台：大厅对你的《${liveItem.title}》的竞争已进入白热化顶峰！买家正在等待你进行【一锤定音】。`);
      } else {
        exports.triggerDynamicLobbyBiddingWar(itemId);
      }
    }, delay);
  };

  // 获取谈判对手的 ID
  function getChatPartnerId(item) {
    const chatData = rsa.state.chats[item.id];
    return chatData ? chatData.opponentId : (rsa.state.allChars[0]?.id || "unknown");
  }

  function firstMsgContainsCharName(text, char) {
    if (!text) return false;
    const name = char.name || "";
    const handle = char.handle || "";
    return text.includes(name) || text.includes(handle);
  }

  function initialTextOf(history) {
    const firstMsg = history.find(m => m.sender === "char");
    return firstMsg ? firstMsg.text : "";
  }

})(window.RocheSellerAuction.api);