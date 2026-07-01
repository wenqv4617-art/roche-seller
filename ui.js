// 挂载至全局 ui 空间
(function(exports) {
  
  // 注入 Ins 极简白与黑奢华风格样式，强制硬性隔离
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
      }
      .rsa-card-header {
        display: flex;
        align-items: center;
        padding: 14px;
        border-bottom: 1px solid #efefef;
      }
      
      /* 头像硬性尺寸限制 */
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
      /* 谈判房间专用条 */
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
      /* 消息列表 */
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
      /* VIP 密闭私室聊天框 */
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
      .rsa-chat-input-area {
        display: flex;
        flex-direction: column;
        border-top: 1px solid #dbdbdb;
        background-color: #ffffff;
        padding: 12px 16px;
        gap: 8px;
      }
      .rsa-input {
        width: 100%;
        border: 1px solid #dbdbdb;
        border-radius: 20px;
        padding: 10px 16px;
        font-size: 13px;
        outline: none;
      }
      /* 个人中心 */
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
    const rsa = window.RocheSellerAuction;
    const header = document.createElement("header");
    header.className = "rsa-header";

    let titleText = "ROCHE AUCTION";
    let leftBtnHtml = "";

    if (rsa.state.activeChatId) {
      titleText = "VIP包厢签约谈判";
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

  // 底部栏
  exports.renderNavBar = function() {
    const rsa = window.RocheSellerAuction;
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
        name: "包间密谈",
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
    const rsa = window.RocheSellerAuction;
    const root = document.createElement("div");
    const grid = document.createElement("div");
    grid.className = "rsa-grid";

    // 只展示处于 active 活动状态的拍卖品
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

      // 如果用户上架了此藏品，大厅内显示当前竞标的控制区
      let bidControlHtml = "";
      if (isOwner) {
        // 如果是用户自己的物品，且正处于大厅拉锯战中
        const war = rsa.state.biddingWars[item.id] || { active: false };
        bidControlHtml = `
          <div class="rsa-btn-group" style="width: 100%; margin-top: 8px; flex-direction: column; gap: 6px;">
            <div style="font-size:10px; color:#c0392b; text-align:center; width:100%; margin-bottom: 2px;">
              ${war.active ? "大厅竞价拉锯战激烈进行中..." : "大厅竞买热情已达瓶颈！"}
            </div>
            <div style="display:flex; gap:6px; width:100%;">
              <button class="rsa-btn" style="flex:1; background-color:#c0392b;" id="rsa-user-settle-${item.id}">一锤定音 (以¥${item.currentBid}成交)</button>
              <button class="rsa-btn rsa-btn-outline" style="flex:1;" id="rsa-cancel-${item.id}">强制下架</button>
            </div>
          </div>
        `;
      } else {
        bidControlHtml = `
          <div class="rsa-btn-group">
            ${isNpc ? "" : `<button class="rsa-btn rsa-btn-outline" id="rsa-chat-${item.id}">VIP私密谈判</button>`}
            <button class="rsa-btn" id="rsa-bid-${item.id}">大厅举牌加价</button>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="rsa-card-header">
          <img class="rsa-avatar" src="${item.sellerAvatar || 'data:image/svg+xml;utf8,<svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"100%\" height=\"100%\" fill=\"%23e1e1e1\"/><circle cx=\"12\" cy=\"12\" r=\"8\" fill=\"%23999999\"/></svg>'}" />
          <div class="rsa-seller-info">
            <span class="rsa-seller-name">${item.sellerName}</span>
            <span class="rsa-seller-tag">${item.isUserItem ? "你上架的" : (isNpc ? "NPC买手" : "主线角色")}</span>
          </div>
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
              <span class="rsa-bid-label">最高举牌价 (CNY)</span>
              <span class="rsa-bid-price">¥ ${item.currentBid}</span>
              <span style="font-size:10px; color:#8e8e8e; margin-top: 2px;">最高竞拍者: ${item.highestBidderName || "无"}</span>
            </div>
            ${bidControlHtml}
          </div>
        </div>
      `;

      // 大厅举牌加价按钮
      const bidBtn = card.querySelector(`#rsa-bid-${item.id}`);
      if (bidBtn) {
        bidBtn.onclick = async () => {
          const currentUserName = rsa.state.activePersona ? (rsa.state.activePersona.handle || rsa.state.activePersona.name) : "你";
          const userBidInput = prompt(`当前大厅最高举牌 ¥${item.currentBid}。请输入你的出价（必须大于当前价格）：`, item.currentBid + 100);
          if (userBidInput === null) return;

          const userBid = parseInt(userBidInput, 10);
          if (isNaN(userBid) || userBid <= item.currentBid) {
            rsa.roche.ui.toast("出价不符合竞价规则。");
            return;
          }

          item.currentBid = userBid;
          item.highestBidderName = `${currentUserName} (你的面具)`;
          await rsa.api.saveData();
          rsa.roche.ui.toast(`举牌成功！当前大厅高位 ¥${userBid}`);
          await exports.renderAll();

          // 唤醒背景随机竞标竞争
          rsa.api.triggerDynamicLobbyBiddingWar(item.id);
        };
      }

      // VIP 私密密室谈判
      const chatBtn = card.querySelector(`#rsa-chat-${item.id}`);
      if (chatBtn) {
        chatBtn.onclick = async () => {
          rsa.state.activeChatId = item.id;
          await exports.renderAll();
        };
      }

      // 用户自己上架物品一锤定音
      const settleBtn = card.querySelector(`#rsa-user-settle-${item.id}`);
      if (settleBtn) {
        settleBtn.onclick = async () => {
          const confirm = await rsa.roche.ui.confirm({
            title: "一锤定音",
            message: `您确定要以大厅当前最高出价 ¥${item.currentBid} 成交卖给【${item.highestBidderName}】吗？`
          });
          if (confirm) {
            item.status = "sold";
            item.title = `[已售出] ${item.title}`;
            // 锁定拉锯战
            if (rsa.state.biddingWars[item.id]) {
              rsa.state.biddingWars[item.id].active = false;
            }
            await rsa.api.saveData();
            rsa.roche.ui.toast(`交易契约已签署！你成功售出了《${item.title}》！`);
            await exports.renderAll();
          }
        };
      }

      // 用户强制下架
      const cancelBtn = card.querySelector(`#rsa-cancel-${item.id}`);
      if (cancelBtn) {
        cancelBtn.onclick = async () => {
          const confirm = await rsa.roche.ui.confirm({
            title: "强制撤回下架",
            message: `下架《${item.title}》将中断大厅所有举牌人的竞买行为。确定吗？`
          });
          if (confirm) {
            rsa.state.items = rsa.state.items.filter(i => i.id !== item.id);
            if (rsa.state.biddingWars[item.id]) {
              delete rsa.state.biddingWars[item.id];
            }
            await rsa.api.saveData();
            rsa.roche.ui.toast("已安全下架该挂牌商品");
            await exports.renderAll();
          }
        };
      }

      grid.appendChild(card);
    });

    root.appendChild(grid);
    return root;
  };

  // 2. 包间密谈列表
  exports.renderMessagesList = function() {
    const rsa = window.RocheSellerAuction;
    const root = document.createElement("div");
    root.className = "rsa-chat-list";

    const chatKeys = Object.keys(rsa.state.chats);
    if (chatKeys.length === 0) {
      root.innerHTML = `
        <div class="rsa-empty">
          <svg viewBox="0 0 24 24" style="width: 48px; height: 48px; fill: #dbdbdb; margin-bottom: 12px;"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
          私人VIP包厢隔间内暂时没有进行谈判。<br>去大厅挑选一件角色的物品点击“VIP私密谈判”开始面对面契约密谈。
        </div>
      `;
      return root;
    }

    chatKeys.forEach(itemId => {
      const item = rsa.state.items.find(i => i.id === itemId);
      if (!item) return;

      const history = rsa.state.chats[itemId];
      const lastMsg = history[history.length - 1] || { text: "包间虚位以待...", timestamp: Date.now() };

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
        rsa.state.activeChatId = item.id;
        await exports.renderAll();
      };

      root.appendChild(chatItem);
    });

    return root;
  };

  // 3. VIP 私密包间聊天对话窗口
  exports.renderChatWindow = async function(itemId) {
    const rsa = window.RocheSellerAuction;
    const root = document.createElement("div");
    root.className = "rsa-chat-window";

    const item = rsa.state.items.find(i => i.id === itemId);
    if (!item) {
      root.innerHTML = `<div class="rsa-empty">该物品已线下成交下架。</div>`;
      return root;
    }

    const messages = rsa.state.chats[itemId] || [];

    // 头部契约提示条
    const isSold = item.status === "sold";
    let negotiationHeaderHtml = "";

    if (isSold) {
      negotiationHeaderHtml = `
        <div class="rsa-negotiation-bar" style="background-color: #dff0d8; border-color: #d6e9c6; color: #3c763d;">
          <span>契约达成！物品已成功以 ¥${item.currentBid} 成交签署。</span>
        </div>
      `;
    } else if (item.isUserItem) {
      // 如果这个聊天，是主线角色看上了用户的商品发起的私聊
      negotiationHeaderHtml = `
        <div class="rsa-negotiation-bar">
          <span style="font-weight:600;">【私密契约】</span>
          <span>对方希望绕过大厅以最高议价 <strong>¥${item.currentBid}</strong> 卖给他。</span>
          <div style="display:flex; gap:6px;">
            <button class="rsa-btn" style="background-color:#c0392b; padding:4px 8px; font-size:9px;" id="rsa-deal-accept">直接签字卖Ta</button>
            <button class="rsa-btn rsa-btn-outline" style="padding:4px 8px; font-size:9px;" id="rsa-deal-reject">走大厅竞拍</button>
          </div>
        </div>
      `;
    } else {
      // 用户在与角色谈判买角色的商品，用户拥有“询问是否可以成交”的契约权利
      negotiationHeaderHtml = `
        <div class="rsa-negotiation-bar">
          <span>当前谈判价格：<strong>¥${item.currentBid}</strong></span>
          <button class="rsa-btn" style="background-color:#2e6da4; padding:6px 12px;" id="rsa-deal-ask">询问是否愿意成交契约</button>
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

    // 真正的 AI 实时开场白触发，不出现泛泛占位符
    if (messages.length === 0 && !isSold) {
      // 触发 AI 构建真实的开场白
      setTimeout(async () => {
        await rsa.api.getAIReplyForAuction(item, messages, messagesContainer);
      }, 100);
    }

    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);

    // 输入区
    const inputArea = document.createElement("div");
    inputArea.className = "rsa-chat-input-area";
    inputArea.innerHTML = `
      <input class="rsa-input" type="text" placeholder="${isSold ? '该契约已尘埃落定。' : '线下低声与对方交谈谈判...'}" ${isSold ? 'disabled' : ''} id="rsa-chat-field" />
      <div style="display:flex; justify-content:flex-end; width:100%; margin-top: 4px;">
        <button class="rsa-btn" id="rsa-chat-send" ${isSold ? 'disabled' : ''} style="border-radius: 20px; padding:6px 16px;">细诉</button>
      </div>
    `;

    // 绑定行为

    // 用户同意将藏品私下卖给该角色
    const acceptBtn = negotiationHeaderHtml.includes("rsa-deal-accept") ? null : "dummy";
    const askBtn = negotiationHeaderHtml.includes("rsa-deal-ask") ? null : "dummy";

    root.appendChild(messagesContainer);
    root.appendChild(inputArea);

    // 将头部安全挂载
    root.insertBefore(document.createRange().createContextualFragment(negotiationHeaderHtml), messagesContainer);

    // 绑定事件
    const acceptEl = root.querySelector("#rsa-deal-accept");
    if (acceptEl) {
      acceptEl.onclick = async () => {
        const confirm = await rsa.roche.ui.confirm({
          title: "签署私下买断合同",
          message: `确定要以当前私聊议价 ¥${item.currentBid} 直接卖给【${item.sellerName}】吗？这会关闭该商品的拍卖大厅窗口。`
        });
        if (confirm) {
          item.status = "sold";
          item.title = `[已售出] ${item.title}`;
          await rsa.api.saveData();

          // 注入一句角色成交欢呼消息
          const dealMsg = {
            id: `msg-sold-${Date.now()}`,
            sender: "char",
            text: `*他轻轻收过那份签署完毕的契约，对你露出一个极其满意和信任的微笑。*“爽快。能在这样的拍卖会找到同道中人，真是人生幸事。合作愉快。”`,
            timestamp: Date.now()
          };
          messages.push(dealMsg);
          rsa.state.chats[item.id] = messages;
          await rsa.api.saveData();

          rsa.roche.ui.toast("契约成立！成功售出宝贝！");
          await exports.renderAll();
        }
      };
    }

    const rejectEl = root.querySelector("#rsa-deal-reject");
    if (rejectEl) {
      rejectEl.onclick = async () => {
        const confirm = await rsa.roche.ui.confirm({
          title: "拒绝私聊买断并引流至大厅",
          message: `拒绝私下交易后，【${item.sellerName}】将进入大厅疯狂举牌竞价。确认拒绝吗？`
        });
        if (confirm) {
          // 在私聊留下对方的反应回复
          const rejectMsg = {
            id: `msg-reject-${Date.now()}`,
            sender: "char",
            text: `*他微微耸了耸肩，慢条斯理地站起身来。*“既然你更希望走大厅的流水台面，那我只能回柜台前与那帮俗客拼个你死我活了。我们大厅见。”`,
            timestamp: Date.now()
          };
          messages.push(rejectMsg);
          rsa.state.chats[item.id] = messages;

          // 抬大厅的出价
          item.currentBid += 200;
          item.highestBidderName = `${item.sellerName} (宿主角色)`;
          
          // 彻底删除该私聊历史，迫使用户必须去大厅一锤定音
          delete rsa.state.chats[item.id];
          
          // 激活拉锯战
          rsa.state.biddingWars[item.id] = { bids: 2, active: true };
          await rsa.api.saveData();

          rsa.roche.ui.toast("已拒绝线下买断，该角色正在大厅展开疯狂举牌竞逐！");
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

        // 无论成交与否，都把 AI 产生的声明文本作为角色的回复追加进包间对话中
        const replyMsg = {
          id: `msg-decision-${Date.now()}`,
          sender: "char",
          text: reply.statement,
          timestamp: Date.now()
        };
        messages.push(replyMsg);
        rsa.state.chats[item.id] = messages;
        await rsa.api.saveData();

        if (reply.decision === "agreed") {
          item.status = "sold";
          item.title = `[已购入] ${item.title}`;
          await rsa.api.saveData();
          await rsa.roche.ui.confirm({
            title: "契约达成！",
            message: `恭喜！对方同意了线下交易。你成功以成交价 ¥${item.currentBid} 签署并带走了《${item.title}》！`
          });
        } else {
          rsa.roche.ui.toast("对方对当下的出价或条件不甚满意，可以继续在包厢倾诉谈判");
        }
        await exports.renderAll();
      };
    }

    const sendField = inputArea.querySelector("#rsa-chat-field");
    const sendBtn = inputArea.querySelector("#rsa-chat-send");

    const sendMessageFunc = async () => {
      const text = sendField.value.trim();
      if (!text || isSold) return;

      sendField.value = "";

      const userMsg = { id: `msg-user-${Date.now()}`, sender: "user", text: text, timestamp: Date.now() };
      messages.push(userMsg);
      rsa.state.chats[itemId] = messages;
      await rsa.api.saveData();

      const userBubble = document.createElement("div");
      userBubble.className = "rsa-msg-bubble rsa-msg-sent";
      userBubble.textContent = text;
      messagesContainer.appendChild(userBubble);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      await rsa.api.getAIReplyForAuction(item, messages, messagesContainer);
    };

    if (sendBtn) {
      sendBtn.onclick = sendMessageFunc;
    }
    if (sendField) {
      sendField.onkeydown = (e) => {
        if (e.key === "Enter") sendMessageFunc();
      };
    }

    return root;
  };

  // 4. 我的面板
  exports.renderMineTab = function() {
    const rsa = window.RocheSellerAuction;
    const root = document.createElement("div");

    const profile = document.createElement("div");
    profile.className = "rsa-profile-header";

    const pAvatar = rsa.state.activePersona?.avatar || "";
    const pName = rsa.state.activePersona ? (rsa.state.activePersona.name || rsa.state.activePersona.handle) : "无身份";
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
        <span class="rsa-form-label">秘密故事描述</span>
        <textarea class="rsa-form-input" id="rsa-form-desc" style="resize: none; height: 60px;" placeholder="写下它蕴含的来历或令人着迷的执念..." required></textarea>
      </div>
      
      <div class="rsa-form-group">
        <span class="rsa-form-label">起拍价格 (CNY)</span>
        <input class="rsa-form-input" type="number" id="rsa-form-price" placeholder="请输入起拍价格" required />
      </div>
      
      <button class="rsa-btn" style="margin-top: 8px;" id="rsa-form-submit">挂靠上架交易大厅</button>
    `;

    const submitBtn = form.querySelector("#rsa-form-submit");
    if (submitBtn) {
      submitBtn.onclick = async () => {
        const fTitle = form.querySelector("#rsa-form-title").value.trim();
        const fDesc = form.querySelector("#rsa-form-desc").value.trim();
        const fPriceVal = form.querySelector("#rsa-form-price").value;

        if (!fTitle || !fDesc || !fPriceVal) {
          rsa.roche.ui.toast("上架信息残缺。");
          return;
        }

        const fPrice = parseInt(fPriceVal, 10);
        if (isNaN(fPrice) || fPrice <= 0) {
          rsa.roche.ui.toast("请输入正确的起拍价格。");
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
          highestBidderName: "暂无出价",
          status: "active",
          createdAt: Date.now()
        };

        rsa.state.items.unshift(newItem);
        await rsa.api.saveData();

        rsa.roche.ui.toast("宝贝已挂拍。关系网正在评估角色反应...");
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

  // 切换面具
  exports.renderPersonaPickerModal = function(isForce = false) {
    const rsa = window.RocheSellerAuction;
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
      listContainer.innerHTML = `<div class="rsa-empty" style="padding: 24px;">未检测到可用的 User 人设，请先在宿主中创建人设面具。</div>`;
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
          rsa.roche.ui.toast(`已成功切换身份面具为: ${persona.name || persona.handle}`);
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

  // 全局渲染调度
  exports.renderAll = async function() {
    const rsa = window.RocheSellerAuction;
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
      bodyEl.appendChild(await exports.renderChatWindow(rsa.state.activeChatId));
    } else {
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