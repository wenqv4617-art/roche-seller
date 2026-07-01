// ==================== 1. 扁平化全局状态与变量 ====================
let _roche = null;
let _container = null;
let _bidSimulationTimer = null;

const _state = {
  activeTab: "auction", // "auction" | "messages" | "mine"
  activePersona: null,  // 当前选中的 User 面具
  activeChatId: null,   // 当前正在私聊的物品 ID
  items: [],            // 拍卖品列表
  chats: {},            // 私密聊天历史 (按 itemId 隔离)
  allPersonas: [],      // 宿主的所有 User 面具
  allChars: [],         // 宿主的所有 Character 列表
};

// ==================== 2. 扁平化核心数据逻辑 ====================

// 自动生成角色初始挂牌物品
function generateDefaultItems() {
  const defaultItems = [];
  if (_state.allChars && _state.allChars.length > 0) {
    _state.allChars.forEach((char, index) => {
      const charName = char.name || char.handle || "神秘客";
      const itemsPool = [
        { title: `${charName}的随身手稿`, desc: `一份黄旧的草稿，潦草写着一些关于日常的零碎思考。`, price: 800 },
        { title: `${charName}心爱的复古挂饰`, desc: `设计极为小巧精致的挂饰，似乎承载着某段特别的记忆。`, price: 1500 },
        { title: `《${charName}所见之景》艺术画作`, desc: `特定视角下的极简画作，笔触细腻，光影构图绝佳。`, price: 3200 }
      ];
      const itemTemplate = itemsPool[index % itemsPool.length];
      defaultItems.push({
        id: `item-char-${char.id}-${index}`,
        title: itemTemplate.title,
        description: itemTemplate.desc,
        sellerId: char.id,
        sellerName: charName,
        sellerAvatar: char.avatar || "",
        isUserItem: false,
        currentBid: itemTemplate.price,
        highestBidderName: "系统保留",
        status: "active",
        createdAt: Date.now() - (index * 3600000)
      });
    });
  } else {
    defaultItems.push({
      id: "item-default-1",
      title: "未署名的纯黑美学画作",
      description: "线条极简，充满未知的神秘感。散发着若有若无的高级质感。",
      sellerId: "unknown-1",
      sellerName: "匿名阁下",
      sellerAvatar: "",
      isUserItem: false,
      currentBid: 2400,
      highestBidderName: "暂无",
      status: "active",
      createdAt: Date.now()
    });
  }
  return defaultItems;
}

// 加载数据
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

// 保存数据
async function saveData() {
  await _roche.storage.set("auction_items", _state.items);
  await _roche.storage.set("auction_chats", _state.chats);
  if (_state.activePersona) {
    await _roche.storage.set("selected_persona_id", _state.activePersona.id);
  }
}

// ==================== 3. 扁平化 UI 渲染与交互 ====================

// 选择 User 面具的弹窗
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

// 顶部栏
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

// 底部栏
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

// 模拟加价
function triggerSimulatedBidding(itemId) {
  if (_bidSimulationTimer) {
    clearTimeout(_bidSimulationTimer);
  }

  const delay = Math.floor(Math.random() * 5000) + 5000;
  _bidSimulationTimer = setTimeout(async () => {
    const item = _state.items.find(i => i.id === itemId && i.status === "active");
    if (!item) return;

    if (item.highestBidderName.includes("你的面具") && _state.allChars.length > 0) {
      const availableBidders = _state.allChars.filter(c => c.id !== item.sellerId);
      if (availableBidders.length === 0) return;

      const randomBidder = availableBidders[Math.floor(Math.random() * availableBidders.length)];
      const bidIncrement = Math.floor(Math.random() * 3 + 1) * 100;
      const newBid = item.currentBid + bidIncrement;

      item.currentBid = newBid;
      item.highestBidderName = randomBidder.handle || randomBidder.name;

      await saveData();
      _roche.ui.toast(`提示：${randomBidder.handle || randomBidder.name} 对《${item.title}》出价到 ¥${newBid}！`);
      await renderAll();
    }
  }, delay);
}

// 渲染大厅
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

    card.innerHTML = `
      <div class="rsa-card-header">
        <img class="rsa-avatar" src="${item.sellerAvatar || 'data:image/svg+xml;utf8,<svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"100%\" height=\"100%\" fill=\"%23e1e1e1\"/><circle cx=\"12\" cy=\"12\" r=\"8\" fill=\"%23999999\"/></svg>'}" />
        <div class="rsa-seller-info">
          <span class="rsa-seller-name">${item.sellerName}</span>
          <span class="rsa-seller-tag">${item.isUserItem ? "你上架的" : "宿主角色"}</span>
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
              <button class="rsa-btn rsa-btn-outline" id="rsa-chat-${item.id}">私聊谈判</button>
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

// 消息列表
function renderMessagesList() {
  const root = document.createElement("div");
  root.className = "rsa-chat-list";

  const chatKeys = Object.keys(_state.chats);
  if (chatKeys.length === 0) {
    root.innerHTML = `
      <div class="rsa-empty">
        <svg viewBox="0 0 24 24" style="width: 48px; height: 48px; fill: #dbdbdb; margin-bottom: 12px;"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
        暂无私聊消息。你可以前往大厅，点击“私聊谈判”与角色就上架物品进行私密交易。
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
      <img class="rsa-avatar" src="${item.sellerAvatar || 'data:image/svg+xml;utf8,<svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"100%\" height=\"100%\" fill=\"%23e1e1e1\"/><circle cx=\"12\" cy=\"12\" r=\"8\" fill=\"%23999999\"/></svg>'}" style="width: 44px; height: 44px;" />
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

// 模拟 AI 回复
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
          memoryText = `你与 Ta 的长期记忆摘要：${core} ${facts}`;
        }
      }
    }
  } catch (e) {
    console.warn("未能完全读取关联宿主记忆，将采用基础人设对话", e);
  }

  const userPersonaName = _state.activePersona ? (_state.activePersona.name || _state.activePersona.handle) : "你";
  const userPersonaDetails = _state.activePersona ? (_state.activePersona.persona || _state.activePersona.bio || "") : "";

  const systemPrompt = `你现在在扮演 Roche 里的角色【${item.sellerName}】。
当前你和用户在“Roche 线上拍卖会”的独立私聊房间里，私下商讨你上架的拍卖品。

【上架的拍卖品】：${item.title}
【物品描述】：${item.description}
【当前拍卖大厅里的最高竞价】：¥ ${item.currentBid}

【正在与你对话的用户身份】：
名字: ${userPersonaName}
Ta 的设定/面具: ${userPersonaDetails}

【你的基础人设设定】：
${charPersona}

【你与该用户的过往记忆轨迹】：
${memoryText}

【回复准则】：
1. 保持你的原装人设、说话语调和对该用户的关系态度（无论是疏离、暖昧、主仆、还是仇视，完全遵循过往记忆）。
2. 这是在私密的拍卖通道里。你可以向 Ta 撒娇、推销、骄傲地阐述这件宝贝为什么珍贵，或者就 Ta 的报价进行极其个性化的“拉扯与讨价还价”。
3. 保持字数在 1-3 句话左右。符合现代化 IM 私信简短有力的沟通特征，不要发过于空洞的长篇大论，禁止使用任何 Emoji 图标。
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

    const replyText = res.text || "……（看起来并没有什么想说的）";

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
    _roche.ui.toast("AI 对话连接失败，请检查模型配置");
  }
}

// 渲染聊天窗
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
      text: `你好，我是【${item.sellerName}】。我看到你对我在 拍卖会上架的【${item.title}】很感兴趣。对于这件宝贝，你想出多少钱，或者有什么想问的？`,
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
    <input class="rsa-input" type="text" placeholder="给 ${item.sellerName} 发送消息（协商价格/闲聊）..." id="rsa-chat-field" />
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

// 我的
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

  const form = document.createElement("div");
  form.className = "rsa-form";
  form.innerHTML = `
    <span class="rsa-form-title">发布我的拍卖品</span>
    
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
        isUserItem: true,
        currentBid: fPrice,
        highestBidderName: "尚无出价",
        status: "active",
        createdAt: Date.now()
      };

      _state.items.unshift(newItem);
      await saveData();

      _roche.ui.toast("藏品已成功挂靠至拍卖大厅！");
      _state.activeTab = "auction";
      await renderAll();
    };
  }

  root.appendChild(form);
  return root;
}

// 统一的全局全量渲染调度函数（完全脱离 this）
async function renderAll() {
  _container.innerHTML = "";

  const appEl = document.createElement("div");
  appEl.className = "rsa-container";

  // 强制用户选择面具
  if (!_state.activePersona && _state.allPersonas.length > 0) {
    appEl.appendChild(renderPersonaPickerModal(true));
    _container.appendChild(appEl);
    return;
  }

  appEl.appendChild(renderHeader());

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

  if (!_state.activeChatId) {
    appEl.appendChild(renderNavBar());
  }

  _container.appendChild(appEl);
}

// ==================== 4. 宿主注册接口定义 ====================
window.RochePlugin.register({
  id: "roche-seller-auction",
  name: "Roche 拍卖会",
  version: "1.0.2",
  apps: [
    {
      id: "roche-seller-auction-home",
      name: "拍卖会",
      icon: "shopping_bag",
      async mount(container, roche) {
        // 挂载实例到外部作用域变量
        _container = container;
        _roche = roche;
        _bidSimulationTimer = null;

        // 加载并渲染（直接调用外层扁平函数，100% 避开 this 调用）
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