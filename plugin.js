// ==================== 1. 扁平化全局状态与变量 ====================
let _roche = null;
let _container = null;
let _bidSimulationTimer = null;
let _isRefreshing = false; // 刷新状态锁

const _state = {
  activeTab: "auction", // "auction" | "messages" | "mine"
  activePersona: null,  // 当前选中的 User 面具
  activeChatId: null,   // 当前正在私聊的物品 ID
  items: [],            // 拍卖品列表
  chats: {},            // 私密聊天历史 (按 itemId 隔离)
  allPersonas: [],      // 宿主的所有 User 面具
  allChars: [],         // 宿主的所有 Character 列表
};

// 系统内置高净值 NPC 库
const _systemNpcs = {
  "npc-victor": { name: "维克多", avatar: "data:image/svg+xml;utf8,<svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"100%\" height=\"100%\" fill=\"%232c3e50\"/><circle cx=\"12\" cy=\"12\" r=\"6\" fill=\"%23ecf0f1\"/></svg>", bio: "行商半生的老牌古董商，对古老神秘的机械与文献极度痴迷。" },
  "npc-ashe": { name: "艾希", avatar: "data:image/svg+xml;utf8,<svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"100%\" height=\"100%\" fill=\"%238e44ad\"/><circle cx=\"12\" cy=\"12\" r=\"6\" fill=\"%23f1c40f\"/></svg>", bio: "新浪潮先锋艺术家，偏爱怪诞、离奇且富有强烈精神隐喻的藏品。" },
  "npc-selena": { name: "瑟琳娜", avatar: "data:image/svg+xml;utf8,<svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"100%\" height=\"100%\" fill=\"%23c0392b\"/><circle cx=\"12\" cy=\"12\" r=\"6\" fill=\"%23f39c12\"/></svg>", bio: "名门望族之后，只收集世俗罕见的名家手稿、奢华古宝与皇家遗物。" },
  "npc-buyerh": { name: "匿名买手 H", avatar: "data:image/svg+xml;utf8,<svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"100%\" height=\"100%\" fill=\"%232c3e50\"/><circle cx=\"12\" cy=\"12\" r=\"6\" fill=\"%237f8c8d\"/></svg>", bio: "游走于灰暗地带的神秘买手，专门搜罗蕴含未知超自然能量的禁忌奇物。" }
};

// ==================== 2. JSON 安全清洁解析工具 ====================
function cleanAndParseJSON(rawText) {
  try {
    let cleaned = rawText.trim();
    cleaned = cleaned.replace(/^```json\s*/i, "");
    cleaned = cleaned.replace(/^```\s*/, "");
    cleaned = cleaned.replace(/\s*```$/, "");
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("JSON 结构提取解析失败，原始文本: ", rawText, e);
    return null;
  }
}

// ==================== 3. 世界书挂载加载逻辑 ====================
async function loadWorldbookText() {
  try {
    const entries = await _roche.worldbook.getEntries({ scope: "global" });
    if (entries && entries.length > 0) {
      return entries.map(e => `【${e.trigger || e.name}】：${e.content}`).join("\n");
    }
  } catch (e) {
    console.warn("读取全局世界书失败，将使用空白世界设定：", e);
  }
  return "暂无全局世界设定。";
}

// ==================== 4. 扁平化数据存取 ====================
async function loadData() {
  try {
    _state.allPersonas = (await _roche.persona.getUserPersonas()) || [];
    _state.allChars = (await _roche.character.list()) || [];
  } catch (e) {
    console.error("加载宿主人设和角色失败：", e);
  }

  const savedPersonaId = await _roche.storage.get("selected_persona_id");
  if (savedPersonaId) {
    _state.activePersona = _state.allPersonas.find(p => p.id === savedPersonaId) || _state.allPersonas[0] || null;
  } else {
    _state.activePersona = (await _roche.persona.getActiveUserPersona()) || _state.allPersonas[0] || null;
  }

  let savedItems = await _roche.storage.get("auction_items");
  if (!savedItems || savedItems.length === 0) {
    savedItems = generateDefaultItems();
    await _roche.storage.set("auction_items", savedItems);
  }
  _state.items = savedItems;
  _state.chats = (await _roche.storage.get("auction_chats")) || {};
}

async function saveData() {
  await _roche.storage.set("auction_items", _state.items);
  await _roche.storage.set("auction_chats", _state.chats);
  if (_state.activePersona) {
    await _roche.storage.set("selected_persona_id", _state.activePersona.id);
  }
}

// 本地默认兜底商品
function generateDefaultItems() {
  const defaultItems = [];
  if (_state.allChars && _state.allChars.length > 0) {
    _state.allChars.forEach((char, index) => {
      const charName = char.name || char.handle || "神秘客";
      defaultItems.push({
        id: `item-char-${char.id}-${index}`,
        title: `${charName}随身携带的旧挂饰`,
        description: `带有${charName}过往故事的古朴小挂饰。在阳光下折射出淡淡的铜锈色，似乎包含一段宿主未曾得知的温暖回忆。`,
        sellerId: char.id,
        sellerName: charName,
        sellerAvatar: char.avatar || "",
        isNpc: false,
        isUserItem: false,
        currentBid: 1500,
        highestBidderName: "系统保留",
        status: "active",
        createdAt: Date.now() - (index * 3600000)
      });
    });
  }

  // 混合 NPC 商品
  Object.keys(_systemNpcs).forEach((npcKey, idx) => {
    const npc = _systemNpcs[npcKey];
    defaultItems.push({
      id: `item-npc-${npcKey}-${idx}`,
      title: idx === 0 ? "未被解译的纯黑手抄本" : "发光的深海晶核",
      description: idx === 0 ? "一部纸页完全泛黑的怪诞书籍，上面的符号不属于任何已知的人类文明语系。" : "散发着淡蓝色微光的奇特矿晶，捧在手心能感受到类似潮汐波动的微弱脉搏。",
      sellerId: npcKey,
      sellerName: npc.name,
      sellerAvatar: npc.avatar,
      isNpc: true,
      isUserItem: false,
      currentBid: 2800,
      highestBidderName: "暂无",
      status: "active",
      createdAt: Date.now()
    });
  });

  return defaultItems;
}

// ==================== 5. AI 商品生成与刷新机制 ====================
async function triggerAIRefreshItems() {
  if (_isRefreshing) return;
  _isRefreshing = true;
  _roche.ui.toast("AI 正在重组拍卖会大厅商品中...");

  const worldbookText = await loadWorldbookText();
  const charListInfo = _state.allChars.map(c => `- ID: ${c.id}, 名字: ${c.name || c.handle}, 人设或简介: ${c.persona || c.bio || ""}`).join("\n");
  const npcListInfo = Object.keys(_systemNpcs).map(key => `- ID: ${key}, 名字: ${_systemNpcs[key].name}, 背景: ${_systemNpcs[key].bio}`).join("\n");

  const systemPrompt = `你是一个线上秘密拍卖行的商品规划AI。请根据当前的实际角色（Characters）和内置 NPC，结合游戏世界书，生成 3-4 件全新的符合他们身份、人设、宿主故事、或主线关联记忆的精美拍卖品。

【世界书设定】：
${worldbookText}

【当前可用的挂载角色】：
${charListInfo}

【当前可用的系统 NPC 卖家】：
${npcListInfo}

【生成准则】：
1. 至少有 1-2 件是由实际角色（Characters）上架的物品，描述中必须巧妙融入该角色的人生经历、喜好或记忆暗线，使其显得极其贴切。
2. 至少有 1-2 件是由 NPC 卖家上架的物品。
3. 请严格输出一个合法、无 markdown 包裹、无任何冗余文本的 JSON 数组。数组中每个对象格式如下：
[
  {
    "id": "随机唯一ID",
    "title": "符合人设的拍卖品名称",
    "description": "拍卖品故事背景描述，富有文学色彩，不含任何表情符号",
    "sellerId": "对应的角色ID 或 对应的NPC ID",
    "sellerName": "对应的卖家名字",
    "isNpc": true或false(实际角色为false, 系统NPC为true),
    "currentBid": 整数起拍价,
    "highestBidderName": "暂无"
  }
]
`;

  try {
    const res = await _roche.ai.chat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "请立即输出拍卖品数据，不要带任何开场白或 markdown 符号。" }
      ],
      temperature: 0.8
    });

    const parsedArray = cleanAndParseJSON(res.text);
    if (parsedArray && Array.isArray(parsedArray)) {
      const userItems = _state.items.filter(i => i.isUserItem);
      
      const newItems = parsedArray.map(item => {
        let avatar = "";
        if (item.isNpc) {
          avatar = _systemNpcs[item.sellerId]?.avatar || "";
        } else {
          const char = _state.allChars.find(c => c.id === item.sellerId);
          avatar = char ? (char.avatar || "") : "";
        }

        return {
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
        };
      });

      _state.items = [...userItems, ...newItems];
      await saveData();
      _roche.ui.toast("拍卖大厅商品已成功重组刷新！");
    } else {
      throw new Error("AI 返回的数据不满足 JSON 解析标准");
    }
  } catch (e) {
    console.error("AI 刷新失败，将执行本地降级刷新：", e);
    const userItems = _state.items.filter(i => i.isUserItem);
    _state.items = [...userItems, ...generateDefaultItems()];
    await saveData();
    _roche.ui.toast("AI 服务繁忙，已执行默认商品刷新。");
  } finally {
    _isRefreshing = false;
    await renderAll();
  }
}

// ==================== 6. 用户上架自动触发关系网反应 ====================
async function triggerCharReactionToUserItem(userItem) {
  if (_state.allChars.length === 0) return;

  const worldbookText = await loadWorldbookText();
  const charListInfo = _state.allChars.map(c => `- ID: ${c.id}, 名字: ${c.name || c.handle}, 人设或简介: ${c.persona || c.bio || ""}`).join("\n");

  const systemPrompt = `你是一个拍卖会买家反应决策AI。
用户在秘密拍卖行刚刚上架了一件藏品：
【物品标题】: ${userItem.title}
【物品描述】: ${userItem.description}
【起拍底价】: ¥ ${userItem.currentBid}

【世界书设定】：
${worldbookText}

【当前可选择的主线角色关系网】：
${charListInfo}

请从可用角色中，挑选一个最有可能对这件藏品产生强烈情绪、渴望或者有背景纠葛的角色。
请为该角色在以下两种反应中选择一种，并严格输出一个合法、无 markdown 包裹的 JSON 对象：
1. "chat"（直接对该商品发起私密私聊，向用户探讨甚至希望高价私下买走，字数在1-3句简短有力，符合人物语气）。
2. "bid"（直接在大厅疯狂竞价，对该物品上抬价格）。

期望输出格式：
{
  "charId": "选中的角色ID",
  "reaction": "chat" 或 "bid",
  "message": "如果选择 chat，请输入对用户发送的第一条私密开场白，绝对符合Ta对用户的态度，不要使用 Emoji",
  "bidAmount": 如果选择 bid，请输入角色竞争出价的整百金额（必须大于当前起拍底价，例如 ${userItem.currentBid + 300}）
}
`;

  try {
    const res = await _roche.ai.chat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "请根据上述逻辑迅速决策该角色的反应。" }
      ],
      temperature: 0.8
    });

    const decision = cleanAndParseJSON(res.text);
    if (decision && decision.charId) {
      const char = _state.allChars.find(c => c.id === decision.charId);
      if (!char) return;

      const charName = char.handle || char.name;

      if (decision.reaction === "chat") {
        const initialMsg = {
          id: `msg-welcome-${Date.now()}`,
          sender: "char",
          text: decision.message || `你好，我是【${charName}】。我对你上架的《${userItem.title}》极其感兴趣。我们能聊聊吗？`,
          timestamp: Date.now()
        };
        _state.chats[userItem.id] = [initialMsg];
        await saveData();

        _roche.ui.toast(`主线提醒：【${charName}】对你的藏品《${userItem.title}》产生了强烈兴趣，已主动发起私聊！`);
      } else if (decision.reaction === "bid") {
        const bidPrice = parseInt(decision.bidAmount, 10) || (userItem.currentBid + 200);
        userItem.currentBid = bidPrice;
        userItem.highestBidderName = `${charName} (宿主角色)`;
        await saveData();

        _roche.ui.toast(`大厅提醒：【${charName}】看中了你的《${userItem.title}》，已在柜台出价到 ¥${bidPrice}！`);
      }
    }
  } catch (e) {
    console.error("角色关系联动评估失败：", e);
    const randomChar = _state.allChars[Math.floor(Math.random() * _state.allChars.length)];
    const randomCharName = randomChar.handle || randomChar.name;
    const fallbackBid = userItem.currentBid + 100;
    userItem.currentBid = fallbackBid;
    userItem.highestBidderName = `${randomCharName} (宿主角色)`;
    await saveData();
    _roche.ui.toast(`大厅提醒：【${randomCharName}】对你的《${userItem.title}》出价到 ¥${fallbackBid}！`);
  } finally {
    await renderAll();
  }
}

// ==================== 7. UI 组件渲染（纯函数无 this） ====================

// 顶部栏渲染
function renderHeader() {
  const header = document.createElement("header");
  header.className = "rsa-header";

  let titleText = "ROCHE AUCTION";
  let leftBtnHtml = "";

  if (_state.activeChatId) {
    titleText = "私密估价与谈判";
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
    closeBtn.onclick = () => _roche.ui.closeApp();
  }

  const backBtn = header.querySelector("#rsa-chat-back");
  if (backBtn) {
    backBtn.onclick = async () => {
      _state.activeChatId = null;
      await renderAll();
    };
  }

  return header;
}

// 底部栏导航渲染
function renderNavBar() {
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
      name: "消息",
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
    btn.className = `rsa-nav-item ${_state.activeTab === tab.id ? "active" : ""}`;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" class="rsa-nav-icon">${tab.svg}</svg>
      <span>${tab.name}</span>
    `;
    btn.onclick = async () => {
      _state.activeTab = tab.id;
      _state.activeChatId = null;
      await renderAll();
    };
    nav.appendChild(btn);
  });

  return nav;
}

// 拍卖大厅主面板
function renderAuctionCenter() {
  const root = document.createElement("div");
  const grid = document.createElement("div");
  grid.className = "rsa-grid";

  const activeItems = _state.items.filter(item => item.status === "active");

  if (activeItems.length === 0) {
    root.innerHTML = `<div class="rsa-empty">拍卖大厅空空如也</div>`;
    return root;
  }

  activeItems.forEach(item => {
    const card = document.createElement("div");
    card.className = "rsa-card";

    const isOwner = item.isUserItem || (_state.activePersona && item.sellerId === _state.activePersona.id);
    const isNpc = !!item.isNpc;

    card.innerHTML = `
      <div class="rsa-card-header">
        <img class="rsa-avatar" src="${item.sellerAvatar || 'data:image/svg+xml;utf8,<svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"100%\" height=\"100%\" fill=\"%23e1e1e1\"/><circle cx=\"12\" cy=\"12\" r=\"8\" fill=\"%23999999\"/></svg>'}" />
        <div class="rsa-seller-info">
          <span class="rsa-seller-name">${item.sellerName}</span>
          <span class="rsa-seller-tag">${item.isUserItem ? "你上架的" : (isNpc ? "NPC买手" : "宿主角色")}</span>
        </div>
      </div>
      <div class="rsa-card-img-placeholder">
        <div style="text-align: center; padding: 12px;">
          <svg viewBox="0 0 24 24" style="width: 40px; height: 40px; fill: #dbdbdb; margin: 0 auto 8px;"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
          <div style="font-size: 11px;">${item.title}</div>
        </div>
      </div>
      <div class="rsa-card-content">
        <span class="rsa-item-title">${item.title}</span>
        <p class="rsa-item-desc">${item.description}</p>
        
        <div class="rsa-bid-row">
          <div class="rsa-bid-info">
            <span class="rsa-bid-label">当前出价 (CNY)</span>
            <span class="rsa-bid-price">¥ ${item.currentBid}</span>
            <span style="font-size:10px; color:#8e8e8e; margin-top: 2px;">最高出价者: ${item.highestBidderName || "无"}</span>
          </div>
          
          <div class="rsa-btn-group">
            ${isOwner ? `
              <button class="rsa-btn rsa-btn-outline" style="border-color: #ff3b30; color: #ff3b30;" id="rsa-cancel-${item.id}">下架</button>
            ` : `
              ${isNpc ? "" : `<button class="rsa-btn rsa-btn-outline" id="rsa-chat-${item.id}">私聊谈判</button>`}
              <button class="rsa-btn" id="rsa-bid-${item.id}">参与竞价</button>
            `}
          </div>
        </div>
      </div>
    `;

    const bidBtn = card.querySelector(`#rsa-bid-${item.id}`);
    if (bidBtn) {
      bidBtn.onclick = async () => {
        const currentUserName = _state.activePersona ? (_state.activePersona.handle || _state.activePersona.name) : "你";
        const userBidInput = prompt(`当前价格 ¥${item.currentBid}。请输入你的出价（必须为整数且大于当前价格）：`, item.currentBid + 100);
        if (userBidInput === null) return;

        const userBid = parseInt(userBidInput, 10);
        if (isNaN(userBid) || userBid <= item.currentBid) {
          _roche.ui.toast("出价不符合规则，必须高于当前价格。");
          return;
        }

        item.currentBid = userBid;
        item.highestBidderName = `${currentUserName} (你的面具)`;
        await saveData();
        _roche.ui.toast(`出价成功！当前最高价 ¥${userBid}`);
        await renderAll();

        triggerSimulatedBidding(item.id);
      };
    }

    const chatBtn = card.querySelector(`#rsa-chat-${item.id}`);
    if (chatBtn) {
      chatBtn.onclick = async () => {
        _state.activeChatId = item.id;
        await renderAll();
      };
    }

    const cancelBtn = card.querySelector(`#rsa-cancel-${item.id}`);
    if (cancelBtn) {
      cancelBtn.onclick = async () => {
        const confirm = await _roche.ui.confirm({
          title: "下架物品",
          message: `确定要下架“${item.title}”吗？`
        });
        if (confirm) {
          _state.items = _state.items.filter(i => i.id !== item.id);
          await saveData();
          _roche.ui.toast("已成功下架物品");
          await renderAll();
        }
      };
    }

    grid.appendChild(card);
  });

  root.appendChild(grid);
  return root;
}

// 模拟竞价
function triggerSimulatedBidding(itemId) {
  if (_bidSimulationTimer) {
    clearTimeout(_bidSimulationTimer);
  }

  const delay = Math.floor(Math.random() * 4000) + 4000;
  _bidSimulationTimer = setTimeout(async () => {
    const item = _state.items.find(i => i.id === itemId && i.status === "active");
    if (!item) return;

    if (item.highestBidderName.includes("你的面具")) {
      const useNpc = Math.random() > 0.5;
      let bidderName = "神秘竞买人";

      if (useNpc) {
        const keys = Object.keys(_systemNpcs);
        const randomNpc = _systemNpcs[keys[Math.floor(Math.random() * keys.length)]];
        bidderName = `${randomNpc.name} (NPC)`;
      } else if (_state.allChars.length > 0) {
        const availableBidders = _state.allChars.filter(c => c.id !== item.sellerId);
        if (availableBidders.length > 0) {
          const randomChar = availableBidders[Math.floor(Math.random() * availableBidders.length)];
          bidderName = randomChar.handle || randomChar.name;
        } else {
          const keys = Object.keys(_systemNpcs);
          const randomNpc = _systemNpcs[keys[Math.floor(Math.random() * keys.length)]];
          bidderName = `${randomNpc.name} (NPC)`;
        }
      }

      const bidIncrement = Math.floor(Math.random() * 3 + 1) * 100;
      const newBid = item.currentBid + bidIncrement;

      item.currentBid = newBid;
      item.highestBidderName = bidderName;

      await saveData();
      _roche.ui.toast(`大厅消息：${bidderName} 对《${item.title}》出价到 ¥${newBid}！`);
      await renderAll();
    }
  }, delay);
}

// 消息列表
function renderMessagesList() {
  const root = document.createElement("div");
  root.className = "rsa-chat-list";

  const chatKeys = Object.keys(_state.chats);
  if (chatKeys.length === 0) {
    root.innerHTML = `
      <div class="rsa-empty">
        <svg viewBox="0 0 24 24" style="width: 48px; height: 48px; fill: #dbdbdb; margin-bottom: 12px;"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
        暂无私密消息。你可以前往大厅，点击“私聊谈判”与角色进行私密交易。
      </div>
    `;
    return root;
  }

  chatKeys.forEach(itemId => {
    const item = _state.items.find(i => i.id === itemId);
    if (!item) return;

    const history = _state.chats[itemId];
    const lastMsg = history[history.length - 1] || { text: "暂无消息", timestamp: Date.now() };

    const chatItem = document.createElement("div");
    chatItem.className = "rsa-chat-item";
    chatItem.innerHTML = `
      <img class="rsa-avatar-large" src="${item.sellerAvatar || 'data:image/svg+xml;utf8,<svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"100%\" height=\"100%\" fill=\"%23e1e1e1\"/><circle cx=\"12\" cy=\"12\" r=\"8\" fill=\"%23999999\"/></svg>'}" />
      <div class="rsa-chat-detail">
        <div class="rsa-chat-header">
          <span class="rsa-chat-name">${item.sellerName} <span style="font-weight: normal; font-size: 11px; color: #8e8e8e;">(关于: ${item.title})</span></span>
          <span class="rsa-chat-time">${new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <p class="rsa-chat-preview">${lastMsg.text}</p>
      </div>
    `;

    chatItem.onclick = async () => {
      _state.activeChatId = item.id;
      await renderAll();
    };

    root.appendChild(chatItem);
  });

  return root;
}

// 模拟 AI 回应
async function getAIReplyForAuction(item, messages, messagesContainer) {
  let charPersona = "";
  let memoryText = "";
  try {
    const char = await _roche.character.get(item.sellerId);
    if (char) {
      charPersona = char.persona || char.bio || "";
      if (char.conversationId) {
        const longTerm = await _roche.memory.getLongTerm({
          conversationId: char.conversationId,
          limit: 50
        });
        if (longTerm) {
          const core = longTerm.core?.summary || "";
          const facts = (longTerm.facts || []).map(f => f.summaryText || f.action || "").join("；");
          memoryText = `长期记忆轨迹摘要：${core} ${facts}`;
        }
      }
    }
  } catch (e) {
    console.warn("未能完全读取关联宿主记忆，将采用基础人设对话", e);
  }

  const userPersonaName = _state.activePersona ? (_state.activePersona.name || _state.activePersona.handle) : "你";
  const userPersonaDetails = _state.activePersona ? (_state.activePersona.persona || _state.activePersona.bio || "") : "";
  const worldbookText = await loadWorldbookText();

  const systemPrompt = `你现在在扮演 Roche 里的角色【${item.sellerName}】。
当前你和用户在“秘密拍卖会”的独立私聊房间里，探讨你上架的物品，或者探讨用户上架的物品。

【当前商讨的拍卖品】：${item.title}
【物品描述】：${item.description}
【当前拍卖大厅价格】：¥ ${item.currentBid}

【世界观基础（世界书设定）】：
${worldbookText}

【正在与你对话的用户身份】：
名字: ${userPersonaName}
Ta 的面具/背景: ${userPersonaDetails}

【你的核心人设】：
${charPersona}

【你与该用户的深层关系记忆】：
${memoryText}

【回复准则】：
1. 绝对遵循你的性格设定与关系态度。如果对用户有宿主历史记忆中存在的依恋、抗拒或警惕，请在此对话中极尽展现出来。
2. 允许将世界书的概念、地名、派系暗线合理融入对话中，体现对话的高级深度。
3. 你们正在私密地讨价还价，你可以向 Ta 解释为什么不想便宜卖，或者向用户索要该物品背后的秘密。
4. 保持字数在 1-3 句话左右，绝对符合 IM 私密聊天的特性，严禁使用任何表情符号（Emoji）。
`;

  const chatPayload = [
    { role: "system", content: systemPrompt }
  ];

  const lastTenMessages = messages.slice(-10);
  lastTenMessages.forEach(m => {
    chatPayload.push({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text
    });
  });

  const typingBubble = document.createElement("div");
  typingBubble.className = "rsa-msg-bubble rsa-msg-received";
  typingBubble.style.opacity = "0.6";
  typingBubble.textContent = `${item.sellerName} 正在输入...`;
  messagesContainer.appendChild(typingBubble);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    const res = await _roche.ai.chat({
      messages: chatPayload,
      temperature: 0.8
    });

    typingBubble.remove();

    const replyText = res.text || "……（默默地看着你，没有多作说明）";

    const charMsg = {
      id: `msg-char-${Date.now()}`,
      sender: "char",
      text: replyText,
      timestamp: Date.now()
    };
    messages.push(charMsg);
    _state.chats[item.id] = messages;
    await saveData();

    const replyBubble = document.createElement("div");
    replyBubble.className = "rsa-msg-bubble rsa-msg-received";
    replyBubble.textContent = replyText;
    messagesContainer.appendChild(replyBubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

  } catch (e) {
    typingBubble.remove();
    console.error("AI 响应失败: ", e);
    _roche.ui.toast("AI 谈判定向连接失败，请检查模型配置");
  }
}

// 聊天窗
async function renderChatWindow(itemId) {
  const root = document.createElement("div");
  root.className = "rsa-chat-window";

  const item = _state.items.find(i => i.id === itemId);
  if (!item) {
    root.innerHTML = `<div class="rsa-empty">该物品已下架或无法找到。</div>`;
    return root;
  }

  const messages = _state.chats[itemId] || [];

  const messagesContainer = document.createElement("div");
  messagesContainer.className = "rsa-chat-messages";

  if (messages.length === 0) {
    const welcomeMsg = {
      id: `msg-welcome-${Date.now()}`,
      sender: "char",
      text: `你好，我是【${item.sellerName}】。我对你的这个【${item.title}】相当看中。我想知道你在哪里得到的？打算多少钱让给我？`,
      timestamp: Date.now()
    };
    messages.push(welcomeMsg);
    _state.chats[itemId] = messages;
    await saveData();
  }

  messages.forEach(msg => {
    const bubble = document.createElement("div");
    bubble.className = `rsa-msg-bubble ${msg.sender === "user" ? "rsa-msg-sent" : "rsa-msg-received"}`;
    bubble.textContent = msg.text;
    messagesContainer.appendChild(bubble);
  });

  setTimeout(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, 50);

  const inputArea = document.createElement("div");
  inputArea.className = "rsa-chat-input-area";
  inputArea.innerHTML = `
    <input class="rsa-input" type="text" placeholder="与 ${item.sellerName} 议价/叙旧..." id="rsa-chat-field" />
    <button class="rsa-btn" id="rsa-chat-send" style="border-radius: 20px;">发送</button>
  `;

  const sendField = inputArea.querySelector("#rsa-chat-field");
  const sendBtn = inputArea.querySelector("#rsa-chat-send");

  const sendMessageFunc = async () => {
    const text = sendField.value.trim();
    if (!text) return;

    sendField.value = "";

    const userMsg = {
      id: `msg-user-${Date.now()}`,
      sender: "user",
      text: text,
      timestamp: Date.now()
    };
    messages.push(userMsg);
    _state.chats[itemId] = messages;
    await saveData();

    const userBubble = document.createElement("div");
    userBubble.className = "rsa-msg-bubble rsa-msg-sent";
    userBubble.textContent = text;
    messagesContainer.appendChild(userBubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    await getAIReplyForAuction(item, messages, messagesContainer);
  };

  sendBtn.onclick = sendMessageFunc;
  sendField.onkeydown = (e) => {
    if (e.key === "Enter") {
      sendMessageFunc();
    }
  };

  root.appendChild(messagesContainer);
  root.appendChild(inputArea);
  return root;
}

// 个人中心 Tab
function renderMineTab() {
  const root = document.createElement("div");

  const profile = document.createElement("div");
  profile.className = "rsa-profile-header";

  const pAvatar = _state.activePersona?.avatar || "";
  const pName = _state.activePersona ? (_state.activePersona.name || _state.activePersona.handle) : "暂无面具";
  const pBio = _state.activePersona?.bio || "暂无简介设定";

  profile.innerHTML = `
    <img class="rsa-profile-avatar" src="${pAvatar || 'data:image/svg+xml;utf8,<svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"100%\" height=\"100%\" fill=\"%23e1e1e1\"/><circle cx=\"12\" cy=\"12\" r=\"8\" fill=\"%23999999\"/></svg>'}" />
    <span class="rsa-profile-name">${pName}</span>
    <p class="rsa-profile-bio">${pBio}</p>
    <button class="rsa-btn rsa-btn-outline" style="font-size: 11px;" id="rsa-btn-switch-mask">切换 User 身份面具</button>
  `;

  const switchBtn = profile.querySelector("#rsa-btn-switch-mask");
  if (switchBtn) {
    switchBtn.onclick = () => {
      const modal = renderPersonaPickerModal(false);
      root.appendChild(modal);
    };
  }
  root.appendChild(profile);

  // 表单
  const form = document.createElement("div");
  form.className = "rsa-form";
  form.innerHTML = `
    <span class="rsa-form-title">挂牌发布我的藏品</span>
    
    <div class="rsa-form-group">
      <span class="rsa-form-label">拍卖品名称</span>
      <input class="rsa-form-input" type="text" id="rsa-form-title" placeholder="如：写给某人的未寄出信件" required />
    </div>
    
    <div class="rsa-form-group">
      <span class="rsa-form-label">拍卖品描述</span>
      <textarea class="rsa-form-input" id="rsa-form-desc" style="resize: none; height: 60px;" placeholder="描述一下它的来源、意义或者背后的秘密..." required></textarea>
    </div>
    
    <div class="rsa-form-group">
      <span class="rsa-form-label">起拍价格 (CNY)</span>
      <input class="rsa-form-input" type="number" id="rsa-form-price" placeholder="请输入起拍底价" required />
    </div>
    
    <button class="rsa-btn" style="margin-top: 8px;" id="rsa-form-submit">确认挂牌上架</button>
  `;

  const submitBtn = form.querySelector("#rsa-form-submit");
  if (submitBtn) {
    submitBtn.onclick = async () => {
      const fTitle = form.querySelector("#rsa-form-title").value.trim();
      const fDesc = form.querySelector("#rsa-form-desc").value.trim();
      const fPriceVal = form.querySelector("#rsa-form-price").value;

      if (!fTitle || !fDesc || !fPriceVal) {
        _roche.ui.toast("请填写完整的藏品上架信息。");
        return;
      }

      const fPrice = parseInt(fPriceVal, 10);
      if (isNaN(fPrice) || fPrice <= 0) {
        _roche.ui.toast("请输入合法的起拍底价。");
        return;
      }

      const newItem = {
        id: `item-user-${Date.now()}`,
        title: fTitle,
        description: fDesc,
        sellerId: _state.activePersona ? _state.activePersona.id : "user",
        sellerName: pName,
        sellerAvatar: pAvatar,
        isNpc: false,
        isUserItem: true,
        currentBid: fPrice,
        highestBidderName: "尚无出价",
        status: "active",
        createdAt: Date.now()
      };

      _state.items.unshift(newItem);
      await saveData();

      _roche.ui.toast("藏品已挂牌上架！正在触发宿主角色市场反应...");
      _state.activeTab = "auction";
      await renderAll();

      // 自动触发有主线故事交集的 Chars 的私聊/竞价决策评估
      setTimeout(async () => {
        await triggerCharReactionToUserItem(newItem);
      }, 1500);
    };
  }

  root.appendChild(form);
  return root;
}

// 切换面具弹窗
function renderPersonaPickerModal(isForce = false) {
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

  if (_state.allPersonas.length === 0) {
    listContainer.innerHTML = `<div class="rsa-empty" style="padding: 24px;">未检测到可用的 User 人设，请先在 Roche 主应用中创建人设面具。</div>`;
  } else {
    _state.allPersonas.forEach(persona => {
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
        _state.activePersona = persona;
        await saveData();
        _roche.ui.toast(`已成功切换身份面具为: ${persona.name || persona.handle}`);
        overlay.remove();
        await renderAll();
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
}

// 统一主调度渲染
async function renderAll() {
  _container.innerHTML = "";

  const appEl = document.createElement("div");
  appEl.className = "rsa-container";

  if (!_state.activePersona && _state.allPersonas.length > 0) {
    appEl.appendChild(renderPersonaPickerModal(true));
    _container.appendChild(appEl);
    return;
  }

  // 1. 顶部栏渲染
  const header = renderHeader();
  
  // 仅在拍卖会主大厅，并且不在具体私聊中，才挂载“刷新”按钮
  if (_state.activeTab === "auction" && !_state.activeChatId) {
    const refreshBtn = document.createElement("button");
    refreshBtn.className = "rsa-header-btn";
    refreshBtn.style.marginRight = "10px";
    refreshBtn.title = "刷新重组大厅商品";
    refreshBtn.innerHTML = `<svg viewBox="0 0 24 24" class="rsa-nav-icon"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`;
    
    refreshBtn.onclick = async () => {
      await triggerAIRefreshItems();
    };
    
    const actionsContainer = header.querySelector(".rsa-header-actions");
    if (actionsContainer) {
      actionsContainer.insertBefore(refreshBtn, actionsContainer.firstChild);
    }
  }

  appEl.appendChild(header);

  // 2. 主体区渲染
  const bodyEl = document.createElement("div");
  bodyEl.className = "rsa-body";

  if (_state.activeChatId) {
    bodyEl.appendChild(await renderChatWindow(_state.activeChatId));
  } else {
    if (_state.activeTab === "auction") {
      bodyEl.appendChild(renderAuctionCenter());
    } else if (_state.activeTab === "messages") {
      bodyEl.appendChild(renderMessagesList());
    } else if (_state.activeTab === "mine") {
      bodyEl.appendChild(renderMineTab());
    }
  }
  appEl.appendChild(bodyEl);

  // 3. 底部导航栏渲染
  if (!_state.activeChatId) {
    appEl.appendChild(renderNavBar());
  }

  _container.appendChild(appEl);
}

// ==================== 8. 宿主注册接口定义 ====================
window.RochePlugin.register({
  id: "roche-seller-auction",
  name: "Roche 拍卖会",
  version: "1.1.1",
  apps: [
    {
      id: "roche-seller-auction-home",
      name: "拍卖会",
      icon: "shopping_bag",
      async mount(container, roche) {
        const styleId = "roche-seller-auction-styles";
        if (!document.getElementById(styleId)) {
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
              font-size: 18px;
              font-weight: 700;
              letter-spacing: 1px;
              text-transform: uppercase;
              color: #262626;
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
            }
            .rsa-body {
              flex: 1;
              overflow-y: auto;
              padding-bottom: 70px;
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
              color: #262626;
            }
            .rsa-nav-icon {
              width: 24px;
              height: 24px;
              fill: currentColor;
              margin-bottom: 2px;
            }
            .rsa-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
              gap: 16px;
              padding: 16px;
            }
            .rsa-card {
              background-color: #ffffff;
              border: 1px solid #dbdbdb;
              border-radius: 8px;
              overflow: hidden;
              display: flex;
              flex-direction: column;
            }
            .rsa-card-header {
              display: flex;
              align-items: center;
              padding: 12px;
              border-bottom: 1px solid #f0f0f0;
            }

            /* ==================== 头像硬限制约束机制 ==================== */
            .rsa-avatar {
              width: 32px !important;
              height: 32px !important;
              min-width: 32px !important;
              min-height: 32px !important;
              flex-shrink: 0 !important;
              border-radius: 50% !important;
              background-color: #efefef !important;
              margin-right: 10px !important;
              object-fit: cover !important;
              border: 1px solid #dbdbdb !important;
              display: block !important;
            }
            .rsa-avatar-large {
              width: 44px !important;
              height: 44px !important;
              min-width: 44px !important;
              min-height: 44px !important;
              flex-shrink: 0 !important;
              border-radius: 50% !important;
              background-color: #efefef !important;
              margin-right: 12px !important;
              object-fit: cover !important;
              border: 1px solid #dbdbdb !important;
              display: block !important;
            }
            .rsa-profile-avatar {
              width: 72px !important;
              height: 72px !important;
              min-width: 72px !important;
              min-height: 72px !important;
              flex-shrink: 0 !important;
              border-radius: 50% !important;
              background-color: #efefef !important;
              object-fit: cover !important;
              border: 1px solid #dbdbdb !important;
              display: block !important;
            }
            /* ========================================================== */

            .rsa-seller-info {
              display: flex;
              flex-direction: column;
            }
            .rsa-seller-name {
              font-size: 13px;
              font-weight: 600;
            }
            .rsa-seller-tag {
              font-size: 10px;
              color: #8e8e8e;
            }
            .rsa-card-img-placeholder {
              height: 180px;
              background: linear-gradient(45deg, #f3f3f3 25%, #ececec 25%, #ececec 50%, #f3f3f3 50%, #f3f3f3 75%, #ececec 75%, #ececec 100%);
              background-size: 40px 40px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #c7c7c7;
              border-bottom: 1px solid #f0f0f0;
            }
            .rsa-card-content {
              padding: 14px;
              display: flex;
              flex-direction: column;
              gap: 6px;
              flex: 1;
            }
            .rsa-item-title {
              font-size: 15px;
              font-weight: 600;
            }
            .rsa-item-desc {
              font-size: 13px;
              color: #555;
              line-height: 1.4;
            }
            .rsa-bid-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: 10px;
              padding-top: 10px;
              border-top: 1px solid #f0f0f0;
            }
            .rsa-bid-info {
              display: flex;
              flex-direction: column;
            }
            .rsa-bid-label {
              font-size: 10px;
              color: #8e8e8e;
              text-transform: uppercase;
            }
            .rsa-bid-price {
              font-size: 16px;
              font-weight: 700;
              color: #262626;
            }
            .rsa-btn {
              background-color: #000000;
              color: #ffffff;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 600;
              cursor: pointer;
              transition: opacity 0.2s ease;
            }
            .rsa-btn:hover {
              opacity: 0.8;
            }
            .rsa-btn-outline {
              background-color: transparent;
              color: #262626;
              border: 1px solid #dbdbdb;
            }
            .rsa-btn-group {
              display: flex;
              gap: 6px;
            }
            .rsa-chat-list {
              display: flex;
              flex-direction: column;
              padding: 8px 0;
            }
            .rsa-chat-item {
              display: flex;
              align-items: center;
              padding: 12px 16px;
              border-bottom: 1px solid #f0f0f0;
              cursor: pointer;
              transition: background-color 0.2s;
            }
            .rsa-chat-item:hover {
              background-color: #f5f5f5;
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
              font-size: 14px;
              font-weight: 600;
            }
            .rsa-chat-time {
              font-size: 11px;
              color: #8e8e8e;
            }
            .rsa-chat-preview {
              font-size: 12px;
              color: #8e8e8e;
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
            }
            .rsa-msg-bubble {
              max-width: 75%;
              padding: 10px 14px;
              border-radius: 18px;
              font-size: 14px;
              line-height: 1.4;
              word-break: break-all;
            }
            .rsa-msg-received {
              align-self: flex-start;
              background-color: #efefef;
              color: #262626;
              border-bottom-left-radius: 4px;
            }
            .rsa-msg-sent {
              align-self: flex-end;
              background-color: #000000;
              color: #ffffff;
              border-bottom-right-radius: 4px;
            }
            .rsa-chat-input-area {
              display: flex;
              align-items: center;
              padding: 12px 16px;
              border-top: 1px solid #dbdbdb;
              background-color: #ffffff;
            }
            .rsa-input {
              flex: 1;
              border: 1px solid #dbdbdb;
              border-radius: 20px;
              padding: 10px 16px;
              font-size: 14px;
              outline: none;
              margin-right: 10px;
            }
            .rsa-profile-header {
              padding: 24px 16px;
              background-color: #ffffff;
              border-bottom: 1px solid #dbdbdb;
              display: flex;
              flex-direction: column;
              align-items: center;
              text-align: center;
              gap: 12px;
            }
            .rsa-form {
              background-color: #ffffff;
              border: 1px solid #dbdbdb;
              border-radius: 8px;
              padding: 16px;
              margin: 16px;
              display: flex;
              flex-direction: column;
              gap: 12px;
            }
            .rsa-form-title {
              font-size: 15px;
              font-weight: 600;
              margin-bottom: 4px;
              border-bottom: 1px solid #f0f0f0;
              padding-bottom: 8px;
            }
            .rsa-form-group {
              display: flex;
              flex-direction: column;
              gap: 6px;
            }
            .rsa-form-label {
              font-size: 12px;
              font-weight: 600;
              color: #262626;
            }
            .rsa-form-input {
              border: 1px solid #dbdbdb;
              border-radius: 4px;
              padding: 8px 12px;
              font-size: 13px;
              outline: none;
            }
            .rsa-empty {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 48px 16px;
              color: #8e8e8e;
              text-align: center;
              font-size: 14px;
            }
            .rsa-overlay {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background-color: rgba(0,0,0,0.5);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 100;
              padding: 16px;
            }
            .rsa-modal {
              background-color: #ffffff;
              border-radius: 12px;
              width: 100%;
              max-width: 400px;
              max-height: 80vh;
              overflow-y: auto;
              display: flex;
              flex-direction: column;
            }
            .rsa-modal-header {
              padding: 16px;
              font-weight: 600;
              border-bottom: 1px solid #dbdbdb;
              text-align: center;
            }
            .rsa-modal-list {
              display: flex;
              flex-direction: column;
            }
            .rsa-modal-item {
              display: flex;
              align-items: center;
              padding: 12px 16px;
              border-bottom: 1px solid #f0f0f0;
              cursor: pointer;
              transition: background-color 0.2s;
            }
            .rsa-modal-item:hover {
              background-color: #f9f9f9;
            }
          `;
          document.head.appendChild(style);
        }

        _container = container;
        _roche = roche;
        _bidSimulationTimer = null;

        await loadData();
        await renderAll();
      },
      async unmount(container, roche) {
        if (_bidSimulationTimer) {
          clearTimeout(_bidSimulationTimer);
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