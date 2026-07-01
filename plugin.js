window.RochePlugin.register({
  id: "roche-seller-auction",
  name: "Roche 拍卖会",
  version: "1.0.0",
  apps: [
    {
      id: "roche-seller-auction-home",
      name: "拍卖会",
      icon: "shopping_bag",
      async mount(container, roche) {
        // 1. 插入组件专属样式（避免污染全局）
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
            /* 顶部栏 */
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
            /* 主体内容区 */
            .rsa-body {
              flex: 1;
              overflow-y: auto;
              padding-bottom: 70px; /* 给底栏留空 */
            }
            /* 底栏导航 */
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
            /* 拍卖大厅列表 */
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
            .rsa-avatar {
              width: 32px;
              height: 32px;
              border-radius: 50%;
              background-color: #efefef;
              margin-right: 10px;
              object-fit: cover;
              border: 1px solid #dbdbdb;
            }
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
            /* 消息页面 */
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
            /* 聊天框详情 */
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
            /* 我的 页面 */
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
            .rsa-profile-avatar {
              width: 72px;
              height: 72px;
              border-radius: 50%;
              background-color: #efefef;
              object-fit: cover;
              border: 1px solid #dbdbdb;
            }
            .rsa-profile-name {
              font-size: 18px;
              font-weight: 600;
            }
            .rsa-profile-bio {
              font-size: 13px;
              color: #8e8e8e;
              max-width: 280px;
            }
            /* 表单设计 */
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
            /* 居中提示/空状态 */
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
            /* 选择面具弹窗 */
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

        // 2. 初始化插件状态和底层数据
        this.roche = roche;
        this.container = container;

        this.state = {
          activeTab: "auction", // "auction" | "messages" | "mine"
          activePersona: null,  // 当前选中的 User 面具
          activeChatId: null,   // 当前正在私聊的物品 ID
          items: [],            // 拍卖品列表
          chats: {},            // 私密聊天历史 (按 itemId 隔离)
          allPersonas: [],      // 宿主的所有 User 面具
          allChars: [],         // 宿主的所有 Character 列表
        };

        // 绑定全局点击事件监听器，用于模拟竞拍的背景定时
        this.bidSimulationTimer = null;

        await this.loadData();
        await this.render();
      },

      async unmount(container, roche) {
        // 清理定时器，防止卸载后泄露
        if (this.bidSimulationTimer) {
          clearTimeout(this.bidSimulationTimer);
        }
        // 清理注入的 CSS 样式
        const style = document.getElementById("roche-seller-auction-styles");
        if (style) {
          style.remove();
        }
        container.replaceChildren();
      },

      // --- 内部数据加载逻辑 ---
      async loadData() {
        const roche = this.roche;

        // 1. 读取宿主所有的 User 面具和角色列表
        try {
          this.state.allPersonas = (await roche.persona.getUserPersonas()) || [];
          this.state.allChars = (await roche.character.list()) || [];
        } catch (e) {
          console.error("加载宿主人设和角色失败：", e);
        }

        // 2. 加载选中的 User 面具
        const savedPersonaId = await roche.storage.get("selected_persona_id");
        if (savedPersonaId) {
          this.state.activePersona = this.state.allPersonas.find(p => p.id === savedPersonaId) || this.state.allPersonas[0] || null;
        } else {
          // 默认取当前的 Active User
          this.state.activePersona = (await roche.persona.getActiveUserPersona()) || this.state.allPersonas[0] || null;
        }

        // 3. 加载拍卖品数据，若为空则自动生成角色初始挂牌物品
        let savedItems = await roche.storage.get("auction_items");
        if (!savedItems || savedItems.length === 0) {
          savedItems = this.generateDefaultItems();
          await roche.storage.set("auction_items", savedItems);
        }
        this.state.items = savedItems;

        // 4. 加载私聊数据
        this.state.chats = (await roche.storage.get("auction_chats")) || {};
      },

      // 生成初始商品列表 (基于当前拥有的 Chars)
      generateDefaultItems() {
        const defaultItems = [];
        if (this.state.allChars && this.state.allChars.length > 0) {
          this.state.allChars.forEach((char, index) => {
            const charName = char.name || char.handle || "神秘客";
            const itemsPool = [
              { title: `${charName}的随身手稿`, desc: `一份泛黄的笔记本手稿，写满了${charName}的日常随笔与隐秘构想。`, price: 800 },
              { title: `${charName}心爱的复古挂饰`, desc: `设计极为小巧精致的挂饰，黄铜质感，似乎承载着某段特别的记忆。`, price: 1500 },
              { title: `《${charName}所见之景》艺术画作`, desc: `由特定视角绘制的极简画作，笔触细腻，光影构图绝佳。`, price: 3200 }
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
          // 无角色时的降级兜底数据
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
      },

      async saveData() {
        await this.roche.storage.set("auction_items", this.state.items);
        await this.roche.storage.set("auction_chats", this.state.chats);
        if (this.state.activePersona) {
          await this.roche.storage.set("selected_persona_id", this.state.activePersona.id);
        }
      },

      // --- 主渲染控制 ---
      async render() {
        this.container.innerHTML = "";

        // 创建根节点
        const appEl = document.createElement("div");
        appEl.className = "rsa-container";

        // 如果没有选择任何 User 面具，必须先强制要求用户选择一个面具作为身份
        if (!this.state.activePersona && this.state.allPersonas.length > 0) {
          appEl.appendChild(this.renderPersonaPickerModal(true));
          this.container.appendChild(appEl);
          return;
        }

        // 1. 顶部 Header
        appEl.appendChild(this.renderHeader());

        // 2. 主体 Body
        const bodyEl = document.createElement("div");
        bodyEl.className = "rsa-body";

        if (this.state.activeChatId) {
          // 进入具体私聊窗口
          bodyEl.appendChild(await this.renderChatWindow(this.state.activeChatId));
        } else {
          // 常规标签页切换
          if (this.state.activeTab === "auction") {
            bodyEl.appendChild(this.renderAuctionCenter());
          } else if (this.state.activeTab === "messages") {
            bodyEl.appendChild(this.renderMessagesList());
          } else if (this.state.activeTab === "mine") {
            bodyEl.appendChild(this.renderMineTab());
          }
        }
        appEl.appendChild(bodyEl);

        // 3. 底部导航栏（若在私聊详情中，则不显示底部 Tab，让用户只能点返回）
        if (!this.state.activeChatId) {
          appEl.appendChild(this.renderNavBar());
        }

        this.container.appendChild(appEl);
      },

      // --- 子组件渲染 ---

      // Header 顶部栏
      renderHeader() {
        const header = document.createElement("header");
        header.className = "rsa-header";

        let titleText = "ROCHE AUCTION";
        let leftBtnHtml = "";

        if (this.state.activeChatId) {
          // 如果在聊天界面，左侧显示返回按钮
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

        // 退出 App
        const closeBtn = header.querySelector("#rsa-btn-close-app");
        if (closeBtn) {
          closeBtn.onclick = () => this.roche.ui.closeApp();
        }

        // 返回上一级
        const backBtn = header.querySelector("#rsa-chat-back");
        if (backBtn) {
          backBtn.onclick = () => {
            this.state.activeChatId = null;
            this.render();
          };
        }

        return header;
      },

      // Bottom Navigation Bar
      renderNavBar() {
        const nav = document.createElement("nav");
        nav.className = "rsa-nav";

        const tabs = [
          {
            id: "auction",
            name: "拍卖大厅",
            // Gavel (Auction) SVG Icon
            svg: `<path d="M14.2 4.63l-2.43-2.43a1.49 1.49 0 0 0-2.12 0l-7.3 7.3a1.49 1.49 0 0 0 0 2.12l2.43 2.43zm-7.9 7.9l-1.42-1.42 6.59-6.59 1.42 1.42zm11.97 3.42h-3.32l2.36-2.36c.59-.59.59-1.54 0-2.12a1.49 1.49 0 0 0-2.12 0L8.7 18.06h9.57c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5zM2 21h20v1H2z"/>`
          },
          {
            id: "messages",
            name: "消息",
            // Direct Message SVG Icon
            svg: `<path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 1 4.28L1.62 21.3c-.39 1.01.62 2.01 1.62 1.62l5.02-1.38c1.28.64 2.74 1 4.28 1 5.52 0 10-4.48 10-10S17.52 2 12 2zm1 14H11v-2h2v2zm0-4H11V7h2v5z"/>`
          },
          {
            id: "mine",
            name: "我的",
            // Account Circle SVG Icon
            svg: `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>`
          }
        ];

        tabs.forEach(tab => {
          const btn = document.createElement("button");
          btn.className = `rsa-nav-item ${this.state.activeTab === tab.id ? "active" : ""}`;
          btn.innerHTML = `
            <svg viewBox="0 0 24 24" class="rsa-nav-icon">${tab.svg}</svg>
            <span>${tab.name}</span>
          `;
          btn.onclick = () => {
            this.state.activeTab = tab.id;
            this.state.activeChatId = null;
            this.render();
          };
          nav.appendChild(btn);
        });

        return nav;
      },

      // 1. 拍卖中心
      renderAuctionCenter() {
        const root = document.createElement("div");
        const grid = document.createElement("div");
        grid.className = "rsa-grid";

        const activeItems = this.state.items.filter(item => item.status === "active");

        if (activeItems.length === 0) {
          root.innerHTML = `<div class="rsa-empty">拍卖大厅空空如也</div>`;
          return root;
        }

        activeItems.forEach(item => {
          const card = document.createElement("div");
          card.className = "rsa-card";

          const isOwner = item.isUserItem || (this.state.activePersona && item.sellerId === this.state.activePersona.id);

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

          // 竞价按钮
          const bidBtn = card.querySelector(`#rsa-bid-${item.id}`);
          if (bidBtn) {
            bidBtn.onclick = async () => {
              const currentUserName = this.state.activePersona ? (this.state.activePersona.handle || this.state.activePersona.name) : "你";
              const userBidInput = prompt(`当前价格 ¥${item.currentBid}。请输入你的出价（必须为整数且大于当前价格）：`, item.currentBid + 100);
              if (userBidInput === null) return;

              const userBid = parseInt(userBidInput, 10);
              if (isNaN(userBid) || userBid <= item.currentBid) {
                this.roche.ui.toast("出价不符合规则，必须高于当前价格。");
                return;
              }

              item.currentBid = userBid;
              item.highestBidderName = `${currentUserName} (你的面具)`;
              await this.saveData();
              this.roche.ui.toast(`出价成功！当前最高价 ¥${userBid}`);
              this.render();

              // 启动背景竞标模拟
              this.triggerSimulatedBidding(item.id);
            };
          }

          // 私聊谈判
          const chatBtn = card.querySelector(`#rsa-chat-${item.id}`);
          if (chatBtn) {
            chatBtn.onclick = () => {
              this.state.activeChatId = item.id;
              this.render();
            };
          }

          // 下架本人的物品
          const cancelBtn = card.querySelector(`#rsa-cancel-${item.id}`);
          if (cancelBtn) {
            cancelBtn.onclick = async () => {
              const confirm = await this.roche.ui.confirm({
                title: "下架物品",
                message: `确定要下架“${item.title}”吗？`
              });
              if (confirm) {
                this.state.items = this.state.items.filter(i => i.id !== item.id);
                await this.saveData();
                this.roche.ui.toast("已成功下架物品");
                this.render();
              }
            };
          }

          grid.appendChild(card);
        });

        root.appendChild(grid);
        return root;
      },

      // 模拟其他角色抢拍竞标
      triggerSimulatedBidding(itemId) {
        if (this.bidSimulationTimer) {
          clearTimeout(this.bidSimulationTimer);
        }

        // 5-10秒内，有50%的概率其他角色会对该物品自动加价
        const delay = Math.floor(Math.random() * 5000) + 5000;
        this.bidSimulationTimer = setTimeout(async () => {
          const item = this.state.items.find(i => i.id === itemId && i.status === "active");
          if (!item) return;

          const activePersonaId = this.state.activePersona ? this.state.activePersona.id : "";
          // 只有当前最高出价是用户自己时，其他角色才更想抢拍
          if (item.highestBidderName.includes("你的面具") && this.state.allChars.length > 0) {
            // 挑选除了该物品卖家以外的随机角色进行竞价
            const availableBidders = this.state.allChars.filter(c => c.id !== item.sellerId);
            if (availableBidders.length === 0) return;

            const randomBidder = availableBidders[Math.floor(Math.random() * availableBidders.length)];
            const bidIncrement = Math.floor(Math.random() * 3 + 1) * 100; // 增加100-300
            const newBid = item.currentBid + bidIncrement;

            item.currentBid = newBid;
            item.highestBidderName = randomBidder.handle || randomBidder.name;

            await this.saveData();
            this.roche.ui.toast(`提示：${randomBidder.handle || randomBidder.name} 对《${item.title}》出价到 ¥${newBid}！`);
            this.render();
          }
        }, delay);
      },

      // 2. 消息页面列表（包含正发生和已谈判过物品对应的私密聊天）
      renderMessagesList() {
        const root = document.createElement("div");
        root.className = "rsa-chat-list";

        const chatKeys = Object.keys(this.state.chats);
        if (chatKeys.length === 0) {
          root.innerHTML = `
            <div class="rsa-empty">
              <svg viewBox="0 0 24 24" style="width: 48px; height: 48px; fill: #dbdbdb; margin-bottom: 12px;"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
              暂无私聊消息。你可以前往大厅，点击“私聊谈判”与角色就上架物品进行私下交易沟通。
            </div>
          `;
          return root;
        }

        chatKeys.forEach(itemId => {
          const item = this.state.items.find(i => i.id === itemId);
          if (!item) return; // 物品已被彻底删除

          const history = this.state.chats[itemId];
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

          chatItem.onclick = () => {
            this.state.activeChatId = item.id;
            this.render();
          };

          root.appendChild(chatItem);
        });

        return root;
      },

      // 聊天会话详情窗口（使用 AI 模拟对话，深度注入角色人设）
      async renderChatWindow(itemId) {
        const root = document.createElement("div");
        root.className = "rsa-chat-window";

        const item = this.state.items.find(i => i.id === itemId);
        if (!item) {
          root.innerHTML = `<div class="rsa-empty">该物品已下架或无法找到。</div>`;
          return root;
        }

        // 历史消息
        const messages = this.state.chats[itemId] || [];

        // 构造消息列表 DOM
        const messagesContainer = document.createElement("div");
        messagesContainer.className = "rsa-chat-messages";

        if (messages.length === 0) {
          // 初始化第一句开场白
          const welcomeMsg = {
            id: `msg-welcome-${Date.now()}`,
            sender: "char",
            text: `你好，我是【${item.sellerName}】。我看到你对我在 Roche 拍卖会上架的【${item.title}】很感兴趣。对于这件宝贝，你想出多少钱，或者有什么想问的？`,
            timestamp: Date.now()
          };
          messages.push(welcomeMsg);
          this.state.chats[itemId] = messages;
          await this.saveData();
        }

        messages.forEach(msg => {
          const bubble = document.createElement("div");
          bubble.className = `rsa-msg-bubble ${msg.sender === "user" ? "rsa-msg-sent" : "rsa-msg-received"}`;
          bubble.textContent = msg.text;
          messagesContainer.appendChild(bubble);
        });

        // 自动滚动到底部
        setTimeout(() => {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 50);

        // 输入区域
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

          // 1. 渲染用户发送的消息
          const userMsg = {
            id: `msg-user-${Date.now()}`,
            sender: "user",
            text: text,
            timestamp: Date.now()
          };
          messages.push(userMsg);
          this.state.chats[itemId] = messages;
          await this.saveData();

          // 局部重绘消息流
          const userBubble = document.createElement("div");
          userBubble.className = "rsa-msg-bubble rsa-msg-sent";
          userBubble.textContent = text;
          messagesContainer.appendChild(userBubble);
          messagesContainer.scrollTop = messagesContainer.scrollHeight;

          // 2. 调用宿主 AI 接口模拟角色的回复
          await this.getAIReplyForAuction(item, messages, messagesContainer);
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
      },

      // 调用 Roche AI 生成带有关联记忆及拍卖逻辑的对话内容
      async getAIReplyForAuction(item, messages, messagesContainer) {
        const roche = this.roche;

        // 1. 获取卖家角色的底层设定数据及长期记忆
        let charPersona = "";
        let memoryText = "";
        try {
          const char = await roche.character.get(item.sellerId);
          if (char) {
            charPersona = char.persona || char.bio || "";
            // 加载该角色在主应用中的历史记忆
            if (char.conversationId) {
              const longTerm = await roche.memory.getLongTerm({
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

        const userPersonaName = this.state.activePersona ? (this.state.activePersona.name || this.state.activePersona.handle) : "你";
        const userPersonaDetails = this.state.activePersona ? (this.state.activePersona.persona || this.state.activePersona.bio || "") : "";

        // 2. 构造 AI 提示词 (Prompt)，促使其深度代入宿主中的人设与关系
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
1. 保持你的原装人设、说话语调和对该用户的关系态度（无论是疏离、暧昧、主仆、还是仇视，完全遵循过往记忆）。
2. 这是在私密的拍卖通道里。你可以向 Ta 撒娇、推销、骄傲地阐述这件宝贝为什么珍贵，或者就 Ta 的报价进行极其个性化的“拉扯与讨价还价”。
3. 保持字数在 1-3 句话左右。符合现代化 IM 私信简短有力的沟通特征，不要发过于空洞的长篇大论，禁止使用任何 Emoji 图标。
`;

        // 将插件本地的历史私聊拼装入 messages
        const chatPayload = [
          { role: "system", content: systemPrompt }
        ];

        // 只保留最近 10 条，避免 token 过长
        const lastTenMessages = messages.slice(-10);
        lastTenMessages.forEach(m => {
          chatPayload.push({
            role: m.sender === "user" ? "user" : "assistant",
            content: m.text
          });
        });

        // 3. 展现打字中状态
        const typingBubble = document.createElement("div");
        typingBubble.className = "rsa-msg-bubble rsa-msg-received";
        typingBubble.style.opacity = "0.6";
        typingBubble.textContent = `${item.sellerName} 正在输入...`;
        messagesContainer.appendChild(typingBubble);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        try {
          const res = await roche.ai.chat({
            messages: chatPayload,
            temperature: 0.8
          });

          typingBubble.remove();

          const replyText = res.text || "……（看起来并没有什么想说的）";

          // 保存消息
          const charMsg = {
            id: `msg-char-${Date.now()}`,
            sender: "char",
            text: replyText,
            timestamp: Date.now()
          };
          messages.push(charMsg);
          this.state.chats[item.id] = messages;
          await this.saveData();

          // 渲染
          const replyBubble = document.createElement("div");
          replyBubble.className = "rsa-msg-bubble rsa-msg-received";
          replyBubble.textContent = replyText;
          messagesContainer.appendChild(replyBubble);
          messagesContainer.scrollTop = messagesContainer.scrollHeight;

        } catch (e) {
          typingBubble.remove();
          console.error("AI 响应失败: ", e);
          roche.ui.toast("AI 对话连接失败，请检查模型配置");
        }
      },

      // 3. 我的 页面（个人信息、上架新物品、切换 User 面具）
      renderMineTab() {
        const root = document.createElement("div");

        // 个人主页 Header 头部
        const profile = document.createElement("div");
        profile.className = "rsa-profile-header";

        const pAvatar = this.state.activePersona?.avatar || "";
        const pName = this.state.activePersona ? (this.state.activePersona.name || this.state.activePersona.handle) : "暂无面具";
        const pBio = this.state.activePersona?.bio || "暂无简介设定";

        profile.innerHTML = `
          <img class="rsa-profile-avatar" src="${pAvatar || 'data:image/svg+xml;utf8,<svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"100%\" height=\"100%\" fill=\"%23e1e1e1\"/><circle cx=\"12\" cy=\"12\" r=\"8\" fill=\"%23999999\"/></svg>'}" />
          <span class="rsa-profile-name">${pName}</span>
          <p class="rsa-profile-bio">${pBio}</p>
          <button class="rsa-btn rsa-btn-outline" style="font-size: 11px;" id="rsa-btn-switch-mask">切换 User 身份面具</button>
        `;

        const switchBtn = profile.querySelector("#rsa-btn-switch-mask");
        if (switchBtn) {
          switchBtn.onclick = () => {
            const modal = this.renderPersonaPickerModal(false);
            root.appendChild(modal);
          };
        }
        root.appendChild(profile);

        // “上架我的藏品” 表单
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
              this.roche.ui.toast("请填写完整的藏品上架信息。");
              return;
            }

            const fPrice = parseInt(fPriceVal, 10);
            if (isNaN(fPrice) || fPrice <= 0) {
              this.roche.ui.toast("请输入合法的起拍底价。");
              return;
            }

            // 新增一件藏品
            const newItem = {
              id: `item-user-${Date.now()}`,
              title: fTitle,
              description: fDesc,
              sellerId: this.state.activePersona ? this.state.activePersona.id : "user",
              sellerName: pName,
              sellerAvatar: pAvatar,
              isUserItem: true,
              currentBid: fPrice,
              highestBidderName: "尚无出价",
              status: "active",
              createdAt: Date.now()
            };

            this.state.items.unshift(newItem); // 插入最前
            await this.saveData();

            this.roche.ui.toast("藏品已成功挂靠至拍卖大厅！");
            this.state.activeTab = "auction";
            this.render();
          };
        }

        root.appendChild(form);
        return root;
      },

      // 选择 User 面具的弹窗
      renderPersonaPickerModal(isForce = false) {
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

        if (this.state.allPersonas.length === 0) {
          listContainer.innerHTML = `<div class="rsa-empty" style="padding: 24px;">未检测到可用的 User 人设，请先在 Roche 主应用中创建人设面具。</div>`;
        } else {
          this.state.allPersonas.forEach(persona => {
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
              this.state.activePersona = persona;
              await this.saveData();
              this.roche.ui.toast(`已成功切换身份面具为: ${persona.name || persona.handle}`);
              overlay.remove();
              this.render();
            };
            listContainer.appendChild(item);
          });
        }

        // 如果不是强制性的，点击遮罩可以关闭
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
    }
  ]
});