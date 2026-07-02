// ==================== 1. 初始化全局共享命名空间 ====================
window.RocheSellerAuction = {
  roche: null,
  container: null,
  isRefreshing: false,
  bidSimulationTimer: null,
  
  // 共享数据状态
  state: {
    activeTab: "auction", // "auction" | "messages" | "mine"
    activePersona: null,
    activeChatId: null,
    items: [],
    chats: {},
    allPersonas: [],
    allChars: [],
    npcRegistry: {},       // 存放 AI 随机生成的动态 NPC 设定
    biddingWars: {}        // 跟踪用户商品的抬价博弈状态 { itemId: { bids: 0, active: true } }
  },
  
  // 子模块占位
  api: {},
  ui: {}
};

// ==================== 2. AI 智能生成与决策层 (原 api.js) ====================
(function(exports) {
  // 安全地在文件作用域顶部获取全局共享命名空间，彻底解决 ReferenceError 问题
  const rsa = window.RocheSellerAuction;

  // 1. 预设托底 NPC 资料库
  const _backupNpcs = [
    { id: "npc-gu-qing", name: "顾清", bio: "古画修复师，能从斑驳墨迹中感知时光执念。", initials: "顾" },
    { id: "npc-quinn", name: "奎恩", bio: "荒原拾荒人，专注于寻找旧时代机械废墟里的精密遗物。", initials: "奎" },
    { id: "npc-lilith", name: "莉莉丝", bio: "赛博义肢买办，偏好微缩齿轮和电磁能量块。", initials: "莉" },
    { id: "npc-reyn", name: "雷恩", bio: "帝国旧教官，醉心于冷兵器与古战场秘辛。", initials: "雷" },
    { id: "npc-shiya", name: "希雅", bio: "迷途的灵修学者，致力于解析精神共鸣与灵魂本质。", initials: "希" }
  ];

  // 2. Base64 安全头像生成器
  function createNpcAvatar(initialLetter) {
    const char = (initialLetter || "N").substring(0, 1);
    const svg = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#2c3e50"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="10" font-family="sans-serif">${char}</text></svg>`;
    try {
      return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
    } catch (e) {
      return `data:image/svg+xml;utf8,<svg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><rect width='100%' height='100%' fill='%232c3e50'/><text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='10' font-family='sans-serif'>${char}</text></svg>`;
    }
  }

  // 3. 强效容错 JSON 清洗器
  function cleanAndParseJSON(rawText) {
    if (!rawText) {
      throw new Error("AI 返回了空内容，无法解析");
    }
    try {
      let cleaned = rawText.trim();
      cleaned = cleaned.replace(/^```json\s*/i, "");
      cleaned = cleaned.replace(/^```\s*/, "");
      cleaned = cleaned.replace(/\s*```$/, "");
      return JSON.parse(cleaned);
    } catch (e) {
      const sample = rawText.replace(/\n/g, " ").substring(0, 80);
      throw new Error(`JSON解析崩溃 (${e.message}) - 原始切片: "${sample}..."`);
    }
  }

  // 4. 世界书挂载
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

  // 5. 数据载入与兼容迁移
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

    // 兼容迁移
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

  // 6. 具象指向性托底商品本地生成器
  function generateDefaultItems() {
    const defaultItems = [];
    if (rsa.state.allChars && rsa.state.allChars.length > 0) {
      rsa.state.allChars.forEach((char, index) => {
        const charName = char.name || char.handle || "神秘客";
        const currentBid = 1500;
        
        // 托底生成高度指向性、极其清晰的生活/故事物件
        const pool = [
          { title: "一条毛线围巾", desc: "针脚有些歪斜的淡灰色围巾，边缘有微微的脱线，能嗅到一丝极淡的皂香与尘土气味。" },
          { title: "一个小时候玩的盒子", desc: "边缘已经严重生锈的小饼干铁盒，盖子上贴着一张早已褪色泛黄、无法辨认的卡通贴纸。" },
          { title: "残破的象棋盘", desc: "红木质地的老旧棋盘，中心有一道显眼的裂痕，其中一侧的“车”字棋子明显是用廉价的桃木临时雕刻补上的。" },
          { title: "丢失分针的怀表", desc: "镀银外壳已经彻底磨损发黑的古旧怀表，里面只剩下一根孤零零的时针，正绝望地卡在九点整的位置。" }
        ];
        const selected = pool[index % pool.length];

        defaultItems.push({
          id: `item-char-${char.id}-${index}`,
          title: `${charName}的${selected.title}`,
          description: `这是${charName}保留至今的物件。${selected.desc}`,
          sellerId: char.id,
          sellerName: charName,
          sellerAvatar: char.avatar || "",
          isNpc: false,
          isUserItem: false,
          currentBid: currentBid,
          highestBidderName: "系统保留",
          bidHistory: generateBiddingHistory(selected.title, currentBid),
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
      const npcObjects = [
        { title: "一个断了弦的八音盒", desc: "暗淡的铜制底座上立着一个掉漆的木偶人。上紧发条后只能发出两声沙哑的干瘪金属摩擦声。" },
        { title: "一叠发黄的旧信封", desc: "被一根已经断掉又重新系起的棉线死死扎着。最上面那一封的邮戳日期是很多年前，字迹已经被水渍洇湿模糊。" },
        { title: "一把生锈的黄铜钥匙", desc: "锯齿边缘已经被磨平，甚至有些微微弯曲，这把钥匙的主人似乎曾无数次试图用它强行开启过某个被卡死的锁孔。" },
        { title: "半副破损的皮质手套", desc: "只有右手单只。掌心处有常年抓握缰绳或粗糙绳索留下的深黑色磨损痕迹，散发着皮革特有的陈旧气息。" },
        { title: "一支沾有干涸蓝墨水的钢笔", desc: "金属笔尖上布满了黑色的墨垢，笔身有些许细密的划痕。笔盖被死死合上，透露出一种被尘封已久的孤寂感。" }
      ];
      const selected = npcObjects[idx % npcObjects.length];

      defaultItems.push({
        id: `item-npc-${npc.id}-${idx}`,
        title: selected.title,
        description: `由【${npc.name}】上架挂牌。${selected.desc}`,
        sellerId: npcKey,
        sellerName: npc.name,
        sellerAvatar: rsa.state.npcRegistry[npcKey].avatar,
        isNpc: true,
        isUserItem: false,
        currentBid: currentBid,
        highestBidderName: npc.name,
        bidHistory: generateBiddingHistory(selected.title, currentBid),
        status: "active",
        createdAt: Date.now()
      });
    });

    return defaultItems;
  }

  // 7. AI 刷新商品大厅 (核心强制具象物件准则)
  exports.triggerAIRefreshItems = async function() {
    if (rsa.isRefreshing) return;
    rsa.isRefreshing = true;
    rsa.roche.ui.toast("AI 正在重组大厅并随机生成买家NPC...");

    const worldbookText = await exports.loadWorldbookText();
    const charListInfo = rsa.state.allChars.map(c => `- ID: ${c.id}, 名字: ${c.name || c.handle}, 设定: ${c.persona || c.bio || ""}`).join("\n");
    const npcNameTemplates = _backupNpcs.map(n => `${n.name} (${n.bio})`).join("、");

    const systemPrompt = `你是一个线上秘密拍卖行的商品与买家NPC规划AI。
请结合世界书，生成 3-4 件全新的拍卖品。

【世界设定】：
${worldbookText}

【当前可用的挂载真实角色】：
${charListInfo}

【NPC 名字与身份偏好参考】：
${npcNameTemplates}

【最高核心准则（具象物件铁律）】：
1. 生成的物品名称必须极其简单、清晰、具体、在现实中可触摸，具有强烈的“指向性”与生活/故事感。
2. 【绝对禁止】生成过于抽象、华丽、玄幻、或修辞空洞的名字。比如严禁使用：“璀璨命运之星”、“深海高能晶核”、“超自然精神契约”、“失落的灵魂碎片”。
3. 【推荐范例】：你必须参考以下文风，生成诸如：“一条围巾”、“一个小时候玩的盒子”、“象棋盘”、“丢失分针的怀表”、“一支沾有墨水的钢笔”、“一件穿旧的呢子大衣”、“半张被烧焦的相片”等具有深度留白暗示与故事温度的具体物品。

【输出生成准则】：
1. 至少有一半的拍卖品是由实际挂载角色（Characters）提供的，将其背景设定或暗线故事融入到对该具体物件的描述中。
2. 每一个由你动态构建的NPC，你必须为其构想独特的“npcBio”。
3. 请严格输出一个合法、无 markdown 格式包裹、不含多余文字的 JSON 数组：
[
  {
    "id": "随机唯一商品ID",
    "title": "符合上述具象物件铁律的名称",
    "description": "围绕这一具体物件展开的故事描述，富有写实的小说质感，细说它的磨损、成色、温度或来历",
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
            bidHistory: generateBiddingHistory(item.title, currentBid)
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

  // 8. 线下 VIP 私密包厢对话 (极致白描小说文风 + 绝对锁定物件物理细节 + 彻底禁止代替 User 代答)
  exports.getAIReplyForAuction = async function(item, messages, messagesContainer) {
    const roche = rsa.roche;

    let talkerId = item.sellerId;
    let talkerName = item.sellerName;

    if (item.isUserItem) {
      const history = rsa.state.chats[item.id];
      if (history && history.opponentId) {
        talkerId = history.opponentId;
        const char = rsa.state.allChars.find(c => c.id === talkerId);
        talkerName = char ? (char.handle || char.name) : (rsa.state.npcRegistry[talkerId]?.name || "神秘买手");
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

    const systemPrompt = `你现在是且只需扮演角色【${item.isUserItem ? "买家" : "卖家"}：${talkerName}】。
当前语境场景：你和用户（User）在拍卖大厅背后的【线下 VIP 私密谈判包厢】内。用户刚刚在大厅对你的藏品《${item.title}》表达了喜爱和兴趣。因此，你提议和用户一起来到这个无人打扰的密闭后室，合拢了厚重的木门，面对面坐下，准备开始就具体交易契约展开商讨。

【最高谈判焦点：必须完美对齐拍卖品的物理状态与名字】：
你当前和对方谈判的，是这一件极为具体的、实存的物理物件：
>>【拍卖品名称】: ${item.title}
>>【物理成色细节与来历背景描述】: ${item.description}
>>【当前大厅最高出价】: ¥ ${item.currentBid}

【白描小说叙事风格 & 核心禁令】：
1. 你的所有谈判言行、讨价还价、情绪拉扯、对物件的估价，都必须牢牢锁死在上述【谈判焦点】的具体物件上。请在你的叙述中巧妙提及它的细节（比如：它磨损的边缘、上面的划痕、泛黑的时针等物理现状），展现出你深知这个物件的来龙去脉与温度。
2. 语言表达要极具“实体存在感”与“活人谈判感”，使用白描实体小说的自然笔触。叙述描写你自己的神态动作时，一律采用【第三人称（他/她/名字）】，并用 * 符号进行包裹。你的台词使用正常的冒号与双引号。
3. 【绝对铁律（唯一禁令）】：不许抢话，不许替 User 代答！你绝对无权干涉、描写、代表或规划 User（用户）的任何肢体动作、言语内容、神态举止或内心戏。在你的回复中，只允许描写你自己的言语以及你自己的角色动作细节！User 的一言一行，完全交给 User 在输入框发给你的自由文本决定。

【世界观基础、你的人设及记忆交集】：
${worldbookText}
你的人设背景：${charPersona}
你与该用户的羁绊：${memoryText}
用户目前的身份背景：${userPersonaDetails}
对用户的称呼：第二人称（你/您）。

【限制】：
1. 保持字数在 120-150 字以内，白描精炼，体现线下对弈的紧绷感。
2. 绝对不许出现任何 Emoji 符号。
`;

    const chatPayload = [{ role: "system", content: systemPrompt }];
    messages.slice(-10).forEach(m => {
      chatPayload.push({ role: m.sender === "user" ? "user" : "assistant", content: m.text });
    });

    const typingBubble = document.createElement("div");
    typingBubble.className = "rsa-msg-bubble rsa-msg-received";
    typingBubble.style.opacity = "0.6";
    typingBubble.textContent = `${item.isUserItem ? "对方" : talkerName} 正在低首思量...`;
    messagesContainer.appendChild(typingBubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      const res = await roche.ai.chat({ messages: chatPayload, temperature: 0.85 });
      typingBubble.remove();

      const replyText = res.text || "……";
      const charMsg = { id: `msg-char-${Date.now()}`, sender: "char", text: replyText, timestamp: Date.now() };
      messages.push(charMsg);
      
      if (!rsa.state.chats[item.id]) {
        rsa.state.chats[item.id] = {
          opponentId: item.sellerId,
          messages: []
        };
      }
      rsa.state.chats[item.id].messages = messages;
      await exports.saveData();

      const replyBubble = document.createElement("div");
      replyBubble.className = "rsa-msg-bubble rsa-msg-received";
      replyBubble.textContent = replyText;
      messagesContainer.appendChild(replyBubble);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (e) {
      typingBubble.remove();
      roche.ui.toast(`AI 对话被阻断: ${e.message || e}`);
    }
  };

  // 9. 询问是否可以交易 (实体博弈小说判定 + 彻底禁止代替 User 代答)
  exports.askForDealDecision = async function(item, messages) {
    const roche = rsa.roche;
    const chatHistoryText = messages.map(m => `${m.sender === "user" ? "用户" : "角色"}: ${m.text}`).join("\n");
    const worldbookText = await exports.loadWorldbookText();

    const systemPrompt = `你现在是线上拍卖行的交易判定AI（后台裁判）。
请客观且睿智地分析【用户】与【角色 ${item.sellerName}】在这间密闭包厢里，就特定藏品开展的线上与线下交易签约判定。

【当前商讨的拍卖品细节】：
>> 物品名称: ${item.title}
>> 物理描述与来历: ${item.description}
>> 大厅报价: ¥${item.currentBid}

【世界书设定背景】：
${worldbookText}

【线下密室谈判历史】：
${chatHistoryText}

【决策逻辑】：
根据上述商讨历史的诚意和条件拉扯，判定角色当前是否愿意与用户达成交易。
请在 JSON 中输出最终决议：
1. 若同意，"decision" 必须为 "agreed"；"statement" 为一段角色当场签契成交的白描台词与内心释放（使用写实小说体，用第三人称描写他/她自己，【唯一铁律：绝不许替 User 作出任何动作描写或代替User回答】）。
2. 若拒绝，"decision" 为 "refused"；"statement" 为角色表示现在诚意尚未足够、或条件尚未达成而温和拒绝的声明（同样绝不代替 User 做出任何行动）。
3. 绝对不许出现任何 Emoji。

请严格输出合法、无 markdown 包裹的 JSON 对象：
{
  "decision": "agreed" 或 "refused",
  "statement": "极具写实活人感、杜绝替User代答的小说体回复"
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
用户在秘密拍卖行刚刚上架了一件极其具体的藏品：
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

// ==================== 3. UI 渲染层 (原 ui.js) ====================
(function(exports) {
  const rsa = window.RocheSellerAuction;

  // 1. 注入 Ins 极简白与黑奢华风格样式
  exports.injectStyles = function() {
    const styleId = "roche-seller-auction-styles";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      .rsa-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        background-color: #fafafa;
        color: #262626;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        box-sizing: border-box;
        position: relative;
      }
      .rsa-container *, .rsa-container *::before, .rsa-container *::after {
        box-sizing: border-box;
      }
      .rsa-header {
        height: 54px;
        background-color: #ffffff;
        border-bottom: 1px solid #dbdbdb;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        position: sticky;
        top: 0;
        z-index: 10;
      }
      .rsa-logo {
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: #111111;
      }
      .rsa-header-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .rsa-header-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        color: #262626;
        transition: opacity 0.2s;
      }
      .rsa-header-btn:hover {
        opacity: 0.6;
      }
      
      /* 主体容器边距优化：包间内与大厅完全物理隔离 */
      .rsa-body {
        flex: 1;
        overflow-y: auto;
        padding-bottom: 76px; /* 大厅保留高边距，避让底部 Tab 栏 */
      }
      .rsa-body.rsa-body-chat {
        padding-bottom: 16px !important; /* 包间缩减为空白边距，完美避让手机自带三键导航，极度贴合下底 */
      }

      .rsa-nav {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 56px;
        background-color: #ffffff;
        border-top: 1px solid #dbdbdb;
        display: flex;
        justify-content: space-around;
        align-items: center;
        z-index: 10;
      }
      .rsa-nav-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: none;
        border: none;
        cursor: pointer;
        color: #8e8e8e;
        font-size: 10px;
        padding: 6px 0;
        width: 33.3%;
        transition: color 0.2s ease;
      }
      .rsa-nav-item.active {
        color: #111111;
      }
      .rsa-nav-icon {
        width: 22px;
        height: 22px;
        fill: currentColor;
        margin-bottom: 2px;
      }
      .rsa-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 20px;
        padding: 20px;
      }
      .rsa-card {
        background-color: #ffffff;
        border: 1px solid #dbdbdb;
        border-radius: 4px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        position: relative;
      }
      .rsa-card-header {
        display: flex;
        align-items: center;
        padding: 14px;
        border-bottom: 1px solid #efefef;
      }
      
      .rsa-avatar {
        width: 32px !important;
        height: 32px !important;
        min-width: 32px !important;
        min-height: 32px !important;
        flex-shrink: 0 !important;
        border-radius: 50% !important;
        background-color: #efefef !important;
        margin-right: 12px !important;
        object-fit: cover !important;
        border: 1px solid #dbdbdb !important;
        display: block !important;
      }
      .rsa-avatar-large {
        width: 40px !important;
        height: 40px !important;
        min-width: 40px !important;
        min-height: 40px !important;
        flex-shrink: 0 !important;
        border-radius: 50% !important;
        background-color: #efefef !important;
        margin-right: 12px !important;
        object-fit: cover !important;
        border: 1px solid #dbdbdb !important;
        display: block !important;
      }
      .rsa-profile-avatar {
        width: 64px !important;
        height: 64px !important;
        min-width: 64px !important;
        min-height: 64px !important;
        flex-shrink: 0 !important;
        border-radius: 50% !important;
        background-color: #efefef !important;
        object-fit: cover !important;
        border: 1px solid #dbdbdb !important;
        display: block !important;
      }

      .rsa-seller-info {
        display: flex;
        flex-direction: column;
      }
      .rsa-seller-name {
        font-size: 13px;
        font-weight: 600;
        color: #262626;
      }
      .rsa-seller-tag {
        font-size: 10px;
        color: #8e8e8e;
        margin-top: 1px;
      }
      .rsa-card-img-placeholder {
        height: 160px;
        background-color: #fafafa;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #c7c7c7;
        border-bottom: 1px solid #efefef;
      }
      .rsa-card-content {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
      }
      .rsa-item-title {
        font-size: 14px;
        font-weight: 700;
        color: #111111;
      }
      .rsa-item-desc {
        font-size: 12px;
        color: #666666;
        line-height: 1.5;
      }
      .rsa-bid-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #efefef;
      }
      .rsa-bid-info {
        display: flex;
        flex-direction: column;
      }
      .rsa-bid-label {
        font-size: 9px;
        color: #8e8e8e;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .rsa-bid-price {
        font-size: 15px;
        font-weight: 800;
        color: #111111;
        margin-top: 2px;
      }
      .rsa-btn {
        background-color: #111111;
        color: #ffffff;
        border: none;
        padding: 8px 14px;
        border-radius: 3px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s;
        letter-spacing: 0.5px;
      }
      .rsa-btn:hover {
        background-color: #333333;
      }
      .rsa-btn-outline {
        background-color: transparent;
        color: #111111;
        border: 1px solid #dbdbdb;
      }
      .rsa-btn-outline:hover {
        background-color: #f5f5f5;
      }
      .rsa-btn-group {
        display: flex;
        gap: 6px;
      }
      .rsa-negotiation-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: #fcf8e3;
        border: 1px solid #faebcc;
        border-radius: 4px;
        padding: 10px 14px;
        margin-bottom: 12px;
        font-size: 12px;
      }
      .rsa-history-panel {
        display: none;
        background-color: #fafafa;
        border-top: 1px solid #efefef;
        padding: 10px 14px;
        font-size: 11px;
        color: #666666;
      }
      .rsa-history-title {
        font-weight: 700;
        color: #111111;
        margin-bottom: 6px;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .rsa-history-item {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
        border-bottom: 1px dotted #e5e5e5;
      }
      .rsa-history-item:last-child {
        border-bottom: none;
        font-weight: 700;
        color: #111111;
      }

      .rsa-chat-list {
        display: flex;
        flex-direction: column;
      }
      .rsa-chat-item {
        display: flex;
        align-items: center;
        padding: 14px 16px;
        border-bottom: 1px solid #f0f0f0;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      .rsa-chat-item:hover {
        background-color: #f9f9f9;
      }
      .rsa-chat-detail {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .rsa-chat-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .rsa-chat-name {
        font-size: 13px;
        font-weight: 700;
      }
      .rsa-chat-time {
        font-size: 10px;
        color: #8e8e8e;
      }
      .rsa-chat-preview {
        font-size: 12px;
        color: #666666;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .rsa-chat-window {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: #ffffff;
      }
      .rsa-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background-color: #fdfdfd;
      }
      .rsa-msg-bubble {
        max-width: 80%;
        padding: 12px 16px;
        border-radius: 12px;
        font-size: 13px;
        line-height: 1.6;
        word-break: break-all;
      }
      .rsa-msg-received {
        align-self: flex-start;
        background-color: #f1f1f1;
        color: #262626;
        border-bottom-left-radius: 2px;
      }
      .rsa-msg-sent {
        align-self: flex-end;
        background-color: #111111;
        color: #ffffff;
        border-bottom-right-radius: 2px;
      }
      
      /* ==================== 自由多行文本输入框 CSS 优化 ==================== */
      .rsa-chat-input-area {
        display: flex;
        align-items: flex-end; /* 按键和输入域底部对齐，实现多行拉伸时的自然排版 */
        border-top: 1px solid #dbdbdb;
        background-color: #ffffff;
        padding: 12px 16px;
        gap: 8px;
        width: 100%;
      }
      .rsa-input {
        flex: 1;
        border: 1px solid #dbdbdb;
        border-radius: 12px; /* 圆角略微收窄符合多行设计 */
        padding: 10px 14px;
        font-size: 13px;
        line-height: 1.4;
        outline: none;
        resize: none; /* 禁用用户右下角手动拖拽拉伸 */
        height: 38px;
        min-height: 38px;
        max-height: 120px; /* 限制自适应的最大高度，超出可在其内部滚动 */
        font-family: inherit;
        background-color: #ffffff;
        transition: border-color 0.2s;
      }
      .rsa-input:focus {
        border-color: #111111;
      }
      /* ========================================================== */

      .rsa-profile-header {
        padding: 30px 16px;
        background-color: #ffffff;
        border-bottom: 1px solid #dbdbdb;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 12px;
      }
      .rsa-profile-name {
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      .rsa-profile-bio {
        font-size: 12px;
        color: #8e8e8e;
        max-width: 300px;
        line-height: 1.4;
      }
      .rsa-form {
        background-color: #ffffff;
        border: 1px solid #dbdbdb;
        border-radius: 4px;
        padding: 20px;
        margin: 20px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .rsa-form-title {
        font-size: 14px;
        font-weight: 700;
        border-bottom: 1px solid #efefef;
        padding-bottom: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .rsa-form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .rsa-form-label {
        font-size: 10px;
        font-weight: 700;
        color: #111111;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .rsa-form-input {
        border: 1px solid #dbdbdb;
        border-radius: 3px;
        padding: 10px 12px;
        font-size: 12px;
        outline: none;
        background-color: #fafafa;
        transition: border-color 0.2s;
      }
      .rsa-form-input:focus {
        border-color: #111111;
      }
      .rsa-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 64px 16px;
        color: #8e8e8e;
        text-align: center;
        font-size: 13px;
        line-height: 1.6;
      }
      .rsa-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        padding: 16px;
      }
      .rsa-modal {
        background-color: #ffffff;
        border-radius: 4px;
        width: 100%;
        max-width: 380px;
        max-height: 80vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        border: 1px solid #dbdbdb;
      }
      .rsa-modal-header {
        padding: 16px;
        font-weight: 700;
        border-bottom: 1px solid #dbdbdb;
        text-align: center;
        font-size: 13px;
        letter-spacing: 1px;
      }
      .rsa-modal-list {
        display: flex;
        flex-direction: column;
      }
      .rsa-modal-item {
        display: flex;
        align-items: center;
        padding: 14px 16px;
        border-bottom: 1px solid #f0f0f0;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      .rsa-modal-item:hover {
        background-color: #f9f9f9;
      }
    `;
    document.head.appendChild(style);
  };

  // 顶部栏
  exports.renderHeader = function() {
    const header = document.createElement("header");
    header.className = "rsa-header";

    let titleText = "ROCHE AUCTION";
    let leftBtnHtml = "";

    if (rsa.state.activeChatId) {
      titleText = "VIP后室闭门签约";
      leftBtnHtml = `
        <button class="rsa-header-btn" id="rsa-chat-back">
          <svg viewBox="0 0 24 24" class="rsa-nav-icon"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>
      `;
    }

    header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        ${leftBtnHtml}
        <span class="rsa-logo">${titleText}</span>
      </div>
      <div class="rsa-header-actions">
        <button class="rsa-header-btn" id="rsa-btn-close-app" title="退出拍卖会">
          <svg viewBox="0 0 24 24" class="rsa-nav-icon"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>
    `;

    const closeBtn = header.querySelector("#rsa-btn-close-app");
    if (closeBtn) {
      closeBtn.onclick = () => rsa.roche.ui.closeApp();
    }

    const backBtn = header.querySelector("#rsa-chat-back");
    if (backBtn) {
      backBtn.onclick = async () => {
        rsa.state.activeChatId = null;
        await exports.renderAll();
      };
    }

    return header;
  };

  // 底部导航栏
  exports.renderNavBar = function() {
    const nav = document.createElement("nav");
    nav.className = "rsa-nav";

    const tabs = [
      {
        id: "auction",
        name: "拍卖大厅",
        svg: `<path d="M14.2 4.63l-2.43-2.43a1.49 1.49 0 0 0-2.12 0l-7.3 7.3a1.49 1.49 0 0 0 0 2.12l2.43 2.43zm-7.9 7.9l-1.42-1.42 6.59-6.59 1.42 1.42zm11.97 3.42h-3.32l2.36-2.36c.59-.59.59-1.54 0-2.12a1.49 1.49 0 0 0-2.12 0L8.7 18.06h9.57c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5zM2 21h20v1H2z"/>`
      },
      {
        id: "messages",
        name: "包厢密谈",
        svg: `<path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 1 4.28L1.62 21.3c-.39 1.01.62 2.01 1.62 1.62l5.02-1.38c1.28.64 2.74 1 4.28 1 5.52 0 10-4.48 10-10S17.52 2 12 2zm1 14H11v-2h2v2zm0-4H11V7h2v5z"/>`
      },
      {
        id: "mine",
        name: "我的",
        svg: `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>`
      }
    ];

    tabs.forEach(tab => {
      const btn = document.createElement("button");
      btn.className = `rsa-nav-item ${rsa.state.activeTab === tab.id ? "active" : ""}`;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" class="rsa-nav-icon">${tab.svg}</svg>
        <span>${tab.name}</span>
      `;
      btn.onclick = async () => {
        rsa.state.activeTab = tab.id;
        rsa.state.activeChatId = null;
        await exports.renderAll();
      };
      nav.appendChild(btn);
    });

    return nav;
  };

  // 1. 拍卖大厅渲染
  exports.renderAuctionCenter = function() {
    const root = document.createElement("div");
    const grid = document.createElement("div");
    grid.className = "rsa-grid";

    const activeItems = rsa.state.items.filter(item => item.status === "active");

    if (activeItems.length === 0) {
      root.innerHTML = `<div class="rsa-empty">大厅柜台空空如也。您可以点击右上角“刷新商品”，让AI生成全新商品和买家。</div>`;
      return root;
    }

    activeItems.forEach(item => {
      const card = document.createElement("div");
      card.className = "rsa-card";

      const isOwner = item.isUserItem || (rsa.state.activePersona && item.sellerId === rsa.state.activePersona.id);
      const isNpc = !!item.isNpc;

      const historyList = (item.bidHistory || []).map(h => `
        <div class="rsa-history-item">
          <span>${h.bidderName}</span>
          <span style="font-weight:700;">¥${h.amount}</span>
        </div>
      `).join("");

      const historyPanelHtml = `
        <div class="rsa-history-panel" id="rsa-history-panel-${item.id}">
          <div class="rsa-history-title">竞标账本记录</div>
          ${historyList || '<div style="color:#8e8e8e;">尚无任何出价记录。</div>'}
        </div>
      `;

      let bidControlHtml = "";
      if (isOwner) {
        const war = rsa.state.biddingWars[item.id] || { active: false };
        bidControlHtml = `
          <div class="rsa-btn-group" style="width: 100%; margin-top: 8px; flex-direction: column; gap: 6px;">
            <div style="font-size:10px; color:#c0392b; text-align:center; width:100%; margin-bottom: 2px;">
              ${war.active ? "大厅竞价拉锯战激烈进行中..." : "大厅竞买热情已达瓶颈！"}
            </div>
            <div style="display:flex; gap:6px; width:100%;">
              <button class="rsa-btn" style="flex:1; background-color:#c0392b;" id="rsa-user-settle-${item.id}">一锤定音 (¥${item.currentBid})</button>
              <button class="rsa-btn" style="flex:1; background-color:#2e6da4;" id="rsa-user-continue-${item.id}" ${war.active ? '' : 'disabled'}>继续竞拍</button>
            </div>
          </div>
        `;
      } else {
        bidControlHtml = `
          <div class="rsa-btn-group">
            ${isNpc ? "" : `<button class="rsa-btn rsa-btn-outline" id="rsa-chat-${item.id}">VIP私密谈判</button>`}
            <button class="rsa-btn" id="rsa-bid-${item.id}">大厅举牌</button>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="rsa-card-header" style="justify-content: space-between;">
          <div style="display:flex; align-items:center;">
            <img class="rsa-avatar" src="${item.sellerAvatar || 'data:image/svg+xml;utf8,<svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"100%\" height=\"100%\" fill=\"%23e1e1e1\"/><circle cx=\"12\" cy=\"12\" r=\"8\" fill=\"%23999999\"/></svg>'}" />
            <div class="rsa-seller-info">
              <span class="rsa-seller-name">${item.sellerName}</span>
              <span class="rsa-seller-tag">${item.isUserItem ? "你上架的" : (isNpc ? "NPC买手" : "主线角色")}</span>
            </div>
          </div>
          <button class="rsa-header-btn" id="rsa-toggle-history-${item.id}" title="查看竞标历史账本">
            <svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:#8e8e8e;"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.25 2.52.77-1.28-3.52-2.09V8z"/></svg>
          </button>
        </div>
        <div class="rsa-card-img-placeholder">
          <div style="text-align: center; padding: 12px;">
            <svg viewBox="0 0 24 24" style="width: 32px; height: 32px; fill: #dbdbdb; margin: 0 auto 8px;"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
            <div style="font-size: 11px;">${item.title}</div>
          </div>
        </div>
        <div class="rsa-card-content">
          <span class="rsa-item-title">${item.title}</span>
          <p class="rsa-item-desc">${item.description}</p>
          
          <div class="rsa-bid-row">
            <div class="rsa-bid-info">
              <span class="rsa-bid-label">当前参考出价</span>
              <span class="rsa-bid-price">¥ ${item.currentBid}</span>
              <span style="font-size:10px; color:#8e8e8e; margin-top: 2px;">最高竞拍者: ${item.highestBidderName || "无"}</span>
            </div>
            ${bidControlHtml}
          </div>
        </div>
        ${historyPanelHtml}
      `;

      const toggleBtn = card.querySelector(`#rsa-toggle-history-${item.id}`);
      if (toggleBtn) {
        toggleBtn.onclick = () => {
          const panel = card.querySelector(`#rsa-history-panel-${item.id}`);
          if (panel) {
            const isVisible = panel.style.display === "block";
            panel.style.display = isVisible ? "none" : "block";
          }
        };
      }

      const bidBtn = card.querySelector(`#rsa-bid-${item.id}`);
      if (bidBtn) {
        bidBtn.onclick = async () => {
          const currentUserName = rsa.state.activePersona ? (rsa.state.activePersona.handle || rsa.state.activePersona.name) : "你";
          const userBidInput = prompt(`当前大厅最高举牌 ¥${item.currentBid}。请输入你的出价（必须大于当前价格）：`, item.currentBid + 100);
          if (userBidInput === null) return;

          const userBid = parseInt(userBidInput, 10);
          if (isNaN(userBid) || userBid <= item.currentBid) {
            rsa.roche.ui.toast("出价不符合规则。");
            return;
          }

          item.currentBid = userBid;
          item.highestBidderName = `${currentUserName} (你的面具)`;
          
          if (!item.bidHistory) item.bidHistory = [];
          item.bidHistory.push({ bidderName: `${currentUserName} (面具)`, amount: userBid, time: "最新" });

          await rsa.api.saveData();
          rsa.roche.ui.toast("出价成功！大厅参考价已更新");
          await exports.renderAll();

          setTimeout(async () => {
            const liveItem = rsa.state.items.find(i => i.id === item.id && i.status === "active");
            if (!liveItem || liveItem.highestBidderName !== `${currentUserName} (你的面具)`) return;

            const increment = Math.floor(Math.random() * 3 + 1) * 100;
            const keys = Object.keys(rsa.state.npcRegistry);
            let bidder = "神秘玩家";
            if (keys.length > 0) {
              bidder = rsa.state.npcRegistry[keys[Math.floor(Math.random() * keys.length)]].name + " (NPC)";
            }
            liveItem.currentBid += increment;
            liveItem.highestBidderName = bidder;

            if (!liveItem.bidHistory) liveItem.bidHistory = [];
            liveItem.bidHistory.push({ bidderName: bidder, amount: liveItem.currentBid, time: "刚刚" });

            await rsa.api.saveData();
            rsa.roche.ui.toast(`竞争：【${bidder}】举牌反超，对《${liveItem.title}》出价 ¥${liveItem.currentBid}！`);
            await exports.renderAll();
          }, 3000);
        };
      }

      const chatBtn = card.querySelector(`#rsa-chat-${item.id}`);
      if (chatBtn) {
        chatBtn.onclick = async () => {
          rsa.state.activeChatId = item.id;
          await exports.renderAll();
        };
      }

      const contBtn = card.querySelector(`#rsa-user-continue-${item.id}`);
      if (contBtn) {
        contBtn.onclick = async () => {
          rsa.roche.ui.toast("已在柜台举牌，正在强制推进新一轮大厅拉锯战...");
          rsa.api.triggerDynamicLobbyBiddingWar(item.id);
        };
      }

      const settleBtn = card.querySelector(`#rsa-user-settle-${item.id}`);
      if (settleBtn) {
        settleBtn.onclick = async () => {
          const confirm = await rsa.roche.ui.confirm({
            title: "一锤定音",
            message: `确定以当前最高出价 ¥${item.currentBid} 成交并卖给【${item.highestBidderName}】吗？`
          });
          if (confirm) {
            item.status = "sold";
            item.title = `[已售出] ${item.title}`;
            if (rsa.state.biddingWars[item.id]) {
              rsa.state.biddingWars[item.id].active = false;
            }
            await rsa.api.saveData();
            rsa.roche.ui.toast("交易完成！成功售出藏品！");
            await exports.renderAll();
          }
        };
      }

      grid.appendChild(card);
    });

    root.appendChild(grid);
    return root;
  };

  // 2. 包间谈判对话历史 (超长自动截断为 15 字)
  exports.renderMessagesList = function() {
    const root = document.createElement("div");
    root.className = "rsa-chat-list";

    const chatKeys = Object.keys(rsa.state.chats);
    if (chatKeys.length === 0) {
      root.innerHTML = `
        <div class="rsa-empty">
          <svg viewBox="0 0 24 24" style="width: 48px; height: 48px; fill: #dbdbdb; margin-bottom: 12px;"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
          后间私密包间空荡无人。<br>去大厅挑选一件角色的物品，点击“VIP私密谈判”开始面对面契约博弈。
        </div>
      `;
      return root;
    }

    chatKeys.forEach(itemId => {
      const item = rsa.state.items.find(i => i.id === itemId);
      if (!item) return;

      const chatData = rsa.state.chats[itemId];
      const history = chatData ? (chatData.messages || []) : [];
      const lastMsg = history[history.length - 1] || { text: "包间虚位以待...", timestamp: Date.now() };

      let previewText = lastMsg.text || "";
      if (previewText.length > 15) {
        previewText = previewText.substring(0, 15) + "...";
      }

      let opponentName = item.sellerName;
      if (item.isUserItem && chatData) {
        const opponentId = chatData.opponentId;
        const char = rsa.state.allChars.find(c => c.id === opponentId);
        if (char) {
          opponentName = char.handle || char.name;
        } else {
          const npc = rsa.state.npcRegistry[opponentId];
          opponentName = npc ? npc.name : "神秘买家";
        }
      }

      const chatItem = document.createElement("div");
      chatItem.className = "rsa-chat-item";
      chatItem.innerHTML = `
        <img class="rsa-avatar-large" src="${item.sellerAvatar || 'data:image/svg+xml;utf8,<svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"100%\" height=\"100%\" fill=\"%23e1e1e1\"/><circle cx=\"12\" cy=\"12\" r=\"8\" fill=\"%23999999\"/></svg>'}" />
        <div class="rsa-chat-detail">
          <div class="rsa-chat-header">
            <span class="rsa-chat-name">${opponentName} <span style="font-weight: normal; font-size: 11px; color: #8e8e8e;">(关于: ${item.title})</span></span>
            <span class="rsa-chat-time">${new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <p class="rsa-chat-preview">${previewText}</p>
        </div>
      `;

      chatItem.onclick = async () => {
        rsa.state.activeChatId = item.id;
        await exports.renderAll();
      };

      root.appendChild(chatItem);
    });

    return root;
  };

  // 3. VIP包间对话框渲染 (优化：使用 textarea 自由输入换行，彻底移去回车发送，增加高度自适应)
  exports.renderChatWindow = async function(itemId) {
    const root = document.createElement("div");
    root.className = "rsa-chat-window";

    const item = rsa.state.items.find(i => i.id === itemId);
    if (!item) {
      root.innerHTML = `<div class="rsa-empty">该物品已线下成交并安全离场。</div>`;
      return root;
    }

    const chatData = rsa.state.chats[itemId];
    const messages = chatData ? (chatData.messages || []) : [];

    let opponentName = item.sellerName;
    if (item.isUserItem && chatData) {
      const char = rsa.state.allChars.find(c => c.id === chatData.opponentId);
      opponentName = char ? (char.handle || char.name) : "主线买家";
    }

    const isSold = item.status === "sold";
    let negotiationHeaderHtml = "";

    if (isSold) {
      negotiationHeaderHtml = `
        <div class="rsa-negotiation-bar" style="background-color: #dff0d8; border-color: #d6e9c6; color: #3c763d;">
          <span>契约圆满结案。商品成功以价格 ¥${item.currentBid} 成交交付。</span>
        </div>
      `;
    } else if (item.isUserItem) {
      negotiationHeaderHtml = `
        <div class="rsa-negotiation-bar">
          <span style="font-weight:700;">【私室密约】</span>
          <span>对方有意买断出价 <strong>¥${item.currentBid}</strong></span>
          <div style="display:flex; gap:6px;">
            <button class="rsa-btn" style="background-color:#c0392b; padding:4px 8px; font-size:9px;" id="rsa-deal-accept">卖给Ta</button>
            <button class="rsa-btn rsa-btn-outline" style="padding:4px 8px; font-size:9px;" id="rsa-deal-reject">继续竞拍 (引导至大厅)</button>
          </div>
        </div>
      `;
    } else {
      negotiationHeaderHtml = `
        <div class="rsa-negotiation-bar">
          <span>当前商谈对价：<strong>¥${item.currentBid}</strong></span>
          <button class="rsa-btn" style="background-color:#2e6da4; padding:6px 12px;" id="rsa-deal-ask">询问是否同意成交契约</button>
        </div>
      `;
    }

    const messagesContainer = document.createElement("div");
    messagesContainer.className = "rsa-chat-messages";

    messages.forEach(msg => {
      const bubble = document.createElement("div");
      bubble.className = `rsa-msg-bubble ${msg.sender === "user" ? "rsa-msg-sent" : "rsa-msg-received"}`;
      bubble.textContent = msg.text;
      messagesContainer.appendChild(bubble);
    });

    if (messages.length === 0 && !isSold) {
      setTimeout(async () => {
        await rsa.api.getAIReplyForAuction(item, messages, messagesContainer);
      }, 100);
    }

    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);

    // 自由文本优化：改为 textarea 标签，支持 Enter 自由换行，只有点击右侧“细诉”才发送并请求 API
    const inputArea = document.createElement("div");
    inputArea.className = "rsa-chat-input-area";
    inputArea.innerHTML = `
      <textarea class="rsa-input" placeholder="${isSold ? '该契约已生效签字。' : '线下低声对答 negotiations...'}" ${isSold ? 'disabled' : ''} id="rsa-chat-field"></textarea>
      <button class="rsa-btn" id="rsa-chat-send" ${isSold ? 'disabled' : ''} style="border-radius: 20px; padding:8px 18px; flex-shrink: 0; height: 38px;">细诉</button>
    `;

    root.appendChild(messagesContainer);
    root.appendChild(inputArea);
    root.insertBefore(document.createRange().createContextualFragment(negotiationHeaderHtml), messagesContainer);

    // 绑定成交、拒绝、及交易判定行为
    const acceptEl = root.querySelector("#rsa-deal-accept");
    if (acceptEl) {
      acceptEl.onclick = async () => {
        const confirm = await rsa.roche.ui.confirm({
          title: "签署线下契约",
          message: `确定以议价 ¥${item.currentBid} 直接卖给【${opponentName}】吗？`
        });
        if (confirm) {
          item.status = "sold";
          item.title = `[已售出] ${item.title}`;
          await rsa.api.saveData();

          const dealMsg = {
            id: `msg-sold-${Date.now()}`,
            sender: "char",
            text: `*他缓缓提起毛笔在纸页最下方按下鲜红的私章，望向你时眼里浮出一丝心照不宣的深远笑意。*“爽快。合作愉快。”`,
            timestamp: Date.now()
          };
          messages.push(dealMsg);
          rsa.state.chats[item.id].messages = messages;
          await rsa.api.saveData();

          rsa.roche.ui.toast("契约成立！成功售出藏品！");
          await exports.renderAll();
        }
      };
    }

    const rejectEl = root.querySelector("#rsa-deal-reject");
    if (rejectEl) {
      rejectEl.onclick = async () => {
        const confirm = await rsa.roche.ui.confirm({
          title: "引流至大厅竞争",
          message: `拒绝私售，【${opponentName}】将去拍卖大厅举牌。确定继续大厅竞拍吗？`
        });
        if (confirm) {
          const rejectMsg = {
            id: `msg-reject-${Date.now()}`,
            sender: "char",
            text: `*他微微挪开茶盏，动作平缓地合上折扇。*“既然你执意要在流水明台上拼价码，那我便去外面领教领教他们口袋里的真假了。”`,
            timestamp: Date.now()
          };
          messages.push(rejectMsg);
          rsa.state.chats[item.id].messages = messages;

          item.currentBid += 200;
          item.highestBidderName = `${opponentName} (主线买家)`;

          delete rsa.state.chats[item.id];
          rsa.state.biddingWars[item.id] = { bids: 2, active: true };
          await rsa.api.saveData();

          rsa.roche.ui.toast("已拒绝线下契约，买家退场，大厅竞争加剧！");
          await exports.renderAll();
          rsa.api.triggerDynamicLobbyBiddingWar(item.id);
        }
      };
    }

    const askEl = root.querySelector("#rsa-deal-ask");
    if (askEl) {
      askEl.onclick = async () => {
        rsa.roche.ui.toast("正在小声向对方递交成交意向评估...");
        const reply = await rsa.api.askForDealDecision(item, messages);

        const replyMsg = { id: `msg-decision-${Date.now()}`, sender: "char", text: reply.statement, timestamp: Date.now() };
        messages.push(replyMsg);
        rsa.state.chats[item.id].messages = messages;
        await rsa.api.saveData();

        if (reply.decision === "agreed") {
          item.status = "sold";
          item.title = `[已购入] ${item.title}`;
          await rsa.api.saveData();
          await rsa.roche.ui.confirm({
            title: "契约达成！",
            message: `成交！你成功以协议价 ¥${item.currentBid} 带走了《${item.title}》！`
          });
        } else {
          rsa.roche.ui.toast("对方尚有一些犹豫，可以继续在包厢倾诉博弈");
        }
        await exports.renderAll();
      };
    }

    const sendField = inputArea.querySelector("#rsa-chat-field");
    const sendBtn = inputArea.querySelector("#rsa-chat-send");

    // 高度动态自适应监听器（Textarea Auto-Resize）
    if (sendField && !isSold) {
      sendField.addEventListener("input", function() {
        this.style.height = "auto";
        // scrollHeight 会实时返回其所需的实际像素高度，以此动态伸展
        this.style.height = this.scrollHeight + "px";
      });
    }

    const sendMessageFunc = async () => {
      const text = sendField.value.trim();
      if (!text || isSold) return;

      sendField.value = "";
      sendField.style.height = "38px"; // 发送后重置为单行初始高度

      const userMsg = { id: `msg-user-${Date.now()}`, sender: "user", text: text, timestamp: Date.now() };
      messages.push(userMsg);
      
      if (!rsa.state.chats[itemId]) {
        rsa.state.chats[itemId] = {
          opponentId: item.isUserItem ? "buyer" : item.sellerId,
          messages: []
        };
      }
      rsa.state.chats[itemId].messages = messages;
      await rsa.api.saveData();

      const userBubble = document.createElement("div");
      userBubble.className = "rsa-msg-bubble rsa-msg-sent";
      userBubble.textContent = text;
      messagesContainer.appendChild(userBubble);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      await rsa.api.getAIReplyForAuction(item, messages, messagesContainer);
    };

    if (sendBtn) sendBtn.onclick = sendMessageFunc;

    return root;
  };

  // 4. 我的面板
  exports.renderMineTab = function() {
    const root = document.createElement("div");

    const profile = document.createElement("div");
    profile.className = "rsa-profile-header";

    const pAvatar = rsa.state.activePersona?.avatar || "";
    const pName = rsa.state.activePersona ? (rsa.state.activePersona.name || rsa.state.activePersona.handle) : "无面具";
    const pBio = rsa.state.activePersona?.bio || "暂无简介人设设定";

    profile.innerHTML = `
      <img class="rsa-profile-avatar" src="${pAvatar || 'data:image/svg+xml;utf8,<svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"100%\" height=\"100%\" fill=\"%23e1e1e1\"/><circle cx=\"12\" cy=\"12\" r=\"8\" fill=\"%23999999\"/></svg>'}" />
      <span class="rsa-profile-name">${pName}</span>
      <p class="rsa-profile-bio">${pBio}</p>
      <button class="rsa-btn rsa-btn-outline" style="font-size: 11px;" id="rsa-btn-switch-mask">切换 User 身份面具</button>
    `;

    const switchBtn = profile.querySelector("#rsa-btn-switch-mask");
    if (switchBtn) {
      switchBtn.onclick = () => {
        const modal = exports.renderPersonaPickerModal(false);
        root.appendChild(modal);
      };
    }
    root.appendChild(profile);

    const form = document.createElement("div");
    form.className = "rsa-form";
    form.innerHTML = `
      <span class="rsa-form-title">发布我的拍卖品</span>
      
      <div class="rsa-form-group">
        <span class="rsa-form-label">物品名称</span>
        <input class="rsa-form-input" type="text" id="rsa-form-title" placeholder="如：不愿提起的古老日记本" required />
      </div>
      
      <div class="rsa-form-group">
        <span class="rsa-form-label">执念来历描述</span>
        <textarea class="rsa-form-input" id="rsa-form-desc" style="resize: none; height: 60px;" placeholder="写下它蕴含的惊世秘密..." required></textarea>
      </div>
      
      <div class="rsa-form-group">
        <span class="rsa-form-label">起拍底价 (CNY)</span>
        <input class="rsa-form-input" type="number" id="rsa-form-price" placeholder="请输入起拍价格" required />
      </div>
      
      <button class="rsa-btn" style="margin-top: 8px;" id="rsa-form-submit">挂靠上架大厅柜台</button>
    `;

    const submitBtn = form.querySelector("#rsa-form-submit");
    if (submitBtn) {
      submitBtn.onclick = async () => {
        const fTitle = form.querySelector("#rsa-form-title").value.trim();
        const fDesc = form.querySelector("#rsa-form-desc").value.trim();
        const fPriceVal = form.querySelector("#rsa-form-price").value;

        if (!fTitle || !fDesc || !fPriceVal) {
          rsa.roche.ui.toast("信息填写残缺。");
          return;
        }

        const fPrice = parseInt(fPriceVal, 10);
        if (isNaN(fPrice) || fPrice <= 0) {
          rsa.roche.ui.toast("请输入合法的出价数值。");
          return;
        }

        const newItem = {
          id: `item-user-${Date.now()}`,
          title: fTitle,
          description: fDesc,
          sellerId: rsa.state.activePersona ? rsa.state.activePersona.id : "user",
          sellerName: pName,
          sellerAvatar: pAvatar,
          isNpc: false,
          isUserItem: true,
          currentBid: fPrice,
          highestBidderName: "尚无出价",
          status: "active",
          createdAt: Date.now(),
          bidHistory: [
            { bidderName: "底价挂牌", amount: fPrice, time: "最新" }
          ]
        };

        rsa.state.items.unshift(newItem);
        await rsa.api.saveData();

        rsa.roche.ui.toast("已挂牌！关系网正在评估角色反应...");
        rsa.state.activeTab = "auction";
        await exports.renderAll();

        setTimeout(async () => {
          await rsa.api.triggerCharReactionToUserItem(newItem);
        }, 1500);
      };
    }

    root.appendChild(form);
    return root;
  };

  // 切换身份面具弹窗
  exports.renderPersonaPickerModal = function(isForce = false) {
    const overlay = document.createElement("div");
    overlay.className = "rsa-overlay";

    const modal = document.createElement("div");
    modal.className = "rsa-modal";
    modal.innerHTML = `
      <div class="rsa-modal-header">
        ${isForce ? "请先选择你参与拍卖会的 User 面具" : "切换你在拍卖会的 User 面具"}
      </div>
      <div class="rsa-modal-list" id="rsa-modal-personas"></div>
    `;

    const listContainer = modal.querySelector("#rsa-modal-personas");

    if (rsa.state.allPersonas.length === 0) {
      listContainer.innerHTML = `<div class="rsa-empty">未检测到可用的 User 人设，请先在宿主中创建人设。</div>`;
    } else {
      rsa.state.allPersonas.forEach(persona => {
        const item = document.createElement("div");
        item.className = "rsa-modal-item";
        item.innerHTML = `
          <img class="rsa-avatar" src="${persona.avatar || 'data:image/svg+xml;utf8,<svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"100%\" height=\"100%\" fill=\"%23e1e1e1\"/><circle cx=\"12\" cy=\"12\" r=\"8\" fill=\"%23999999\"/></svg>'}" />
          <div class="rsa-seller-info">
            <span class="rsa-seller-name">${persona.name || persona.handle}</span>
            <span class="rsa-seller-tag" style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${persona.bio || "无简介"}</span>
          </div>
        `;
        item.onclick = async () => {
          rsa.state.activePersona = persona;
          await rsa.api.saveData();
          rsa.roche.ui.toast(`已切换身份面具为: ${persona.name || persona.handle}`);
          overlay.remove();
          await exports.renderAll();
        };
        listContainer.appendChild(item);
      });
    }

    if (!isForce) {
      overlay.onclick = (e) => {
        if (e.target === overlay) {
          overlay.remove();
        }
      };
    }

    overlay.appendChild(modal);
    return overlay;
  };

  // 全局渲染调度（优化：当处于后室密谈时，自动为内容容器追加 .rsa-body-chat 减小下底留白）
  exports.renderAll = async function() {
    rsa.container.innerHTML = "";

    const appEl = document.createElement("div");
    appEl.className = "rsa-container";

    if (!rsa.state.activePersona && rsa.state.allPersonas.length > 0) {
      appEl.appendChild(exports.renderPersonaPickerModal(true));
      rsa.container.appendChild(appEl);
      return;
    }

    const header = exports.renderHeader();

    if (rsa.state.activeTab === "auction" && !rsa.state.activeChatId) {
      const refreshBtn = document.createElement("button");
      refreshBtn.className = "rsa-header-btn";
      refreshBtn.style.marginRight = "10px";
      refreshBtn.title = "刷新重组大厅商品";
      refreshBtn.innerHTML = `<svg viewBox="0 0 24 24" class="rsa-nav-icon"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`;
      refreshBtn.onclick = async () => {
        await rsa.api.triggerAIRefreshItems();
      };
      const actions = header.querySelector(".rsa-header-actions");
      if (actions) actions.insertBefore(refreshBtn, actions.firstChild);
    }

    appEl.appendChild(header);

    const bodyEl = document.createElement("div");
    bodyEl.className = "rsa-body";

    if (rsa.state.activeChatId) {
      // 处于密谈状态下，动态追加 .rsa-body-chat 属性类，将边距硬性缩短为 16px 避让手机底栏
      bodyEl.className = "rsa-body rsa-body-chat";
      bodyEl.appendChild(await exports.renderChatWindow(rsa.state.activeChatId));
    } else {
      bodyEl.className = "rsa-body";
      if (rsa.state.activeTab === "auction") {
        bodyEl.appendChild(exports.renderAuctionCenter());
      } else if (rsa.state.activeTab === "messages") {
        bodyEl.appendChild(exports.renderMessagesList());
      } else if (rsa.state.activeTab === "mine") {
        bodyEl.appendChild(exports.renderMineTab());
      }
    }
    appEl.appendChild(bodyEl);

    if (!rsa.state.activeChatId) {
      appEl.appendChild(exports.renderNavBar());
    }

    rsa.container.appendChild(appEl);
  };

})(window.RocheSellerAuction.ui);

// ==================== 4. 插件注册与生命周期管理 (原 plugin.js) ====================
(async function bootstrap() {
  // 向宿主正式注册
  window.RochePlugin.register({
    id: "roche-seller-auction",
    name: "Roche 拍卖会",
    version: "1.2.0",
    apps: [
      {
        id: "roche-seller-auction-home",
        name: "拍卖会",
        icon: "shopping_bag",
        async mount(container, roche) {
          window.RocheSellerAuction.container = container;
          window.RocheSellerAuction.roche = roche;

          // 初始化样式
          window.RocheSellerAuction.ui.injectStyles();

          // 初始化加载数据
          await window.RocheSellerAuction.api.loadData();
          await window.RocheSellerAuction.ui.renderAll();
        },
        async unmount(container, roche) {
          if (window.RocheSellerAuction.bidSimulationTimer) {
            clearTimeout(window.RocheSellerAuction.bidSimulationTimer);
          }
          const style = document.getElementById("roche-seller-auction-styles");
          if (style) {
            style.remove();
          }
          container.replaceChildren();
        }
      }
    ]
  });
})();