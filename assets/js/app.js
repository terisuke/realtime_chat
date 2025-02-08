// If you want to use Phoenix channels, run `mix help phx.gen.channel`
// to get started and then uncomment the line below.
// import "./user_socket.js"

// You can include dependencies in two ways.
//
// The simplest option is to put them in assets/vendor and
// import them using relative paths:
//
//     import "../vendor/some-package.js"
//
// Alternatively, you can `npm install some-package --prefix assets` and import
// them using a path starting with the package name:
//
//     import "some-package"
//

// Include phoenix_html to handle method=PUT/DELETE in forms and buttons.
import "phoenix_html"
// Establish Phoenix Socket and LiveView configuration.
import { Socket } from "phoenix"
import { LiveSocket } from "phoenix_live_view"
import topbar from "../vendor/topbar"

let csrfToken = document.querySelector("meta[name='csrf-token']").getAttribute("content")
let liveSocket = new LiveSocket("/live", Socket, {
  longPollFallbackMs: 2500,
  params: {_csrf_token: csrfToken}
})

// Show progress bar on live navigation and form submits
topbar.config({barColors: {0: "#29d"}, shadowColor: "rgba(0, 0, 0, .3)"})
window.addEventListener("phx:page-loading-start", _info => topbar.show(300))
window.addEventListener("phx:page-loading-stop", _info => topbar.hide())

// connect if there are any LiveViews on the page
liveSocket.connect()

// expose liveSocket on window for web console debug logs and latency simulation:
// >> liveSocket.enableDebug()
// >> liveSocket.enableLatencySim(1000)  // enabled for duration of browser session
// >> liveSocket.disableLatencySim()
window.liveSocket = liveSocket

//------------------------------------------------------
// リアルタイムチャット用のソケット処理
//------------------------------------------------------

// Phoenixソケットへの接続
let socket = new Socket("/socket", {params: {}})
socket.connect()

// "chat:lobby"チャンネルに参加
let channel = socket.channel("chat:lobby", {})

// 過去メッセージを一括受信
channel.on("load_messages", payload => {
  let messages = payload.messages
  console.log("Loaded messages:", messages)
  appendMessages(messages)
})

// 新規メッセージを受信
channel.on("new_message", payload => {
  let { message } = payload
  console.log("Received new_message:", message)
  appendMessage(message)
})

// チャンネル参加時のハンドラ
channel.join()
  .receive("ok", () => {
    console.log("Successfully joined chat")
    // 接続成功後にメッセージ履歴を要求
    channel.push("get_messages")
  })
  .receive("error", resp => { console.log("Unable to join", resp) })

// DOM要素を取得
let chatForm = document.getElementById("chat-form")
let messageInput = document.getElementById("message-input")
let messagesUL = document.getElementById("messages")

// 返信対象のメッセージID
let replyToId = null;
let replyPreview = document.getElementById("reply-preview");
let cancelReplyBtn = document.getElementById("cancel-reply");

// いいねボタンのイベント
function handleLike(messageId) {
  const likeButton = messagesUL.querySelector(`.like-button[data-message-id="${messageId}"]`);
  if (likeButton) {
    // ボタンを一時的に無効化（連打防止）
    likeButton.disabled = true;
    
    channel.push("like_message", { message_id: messageId })
      .receive("ok", () => {
        // 成功時の処理
        console.log("Like successful");
      })
      .receive("error", (err) => {
        // エラー時の処理
        console.error("Like failed:", err);
        likeButton.disabled = false;
      });
      
    // 1秒後にボタンを再度有効化
    setTimeout(() => {
      likeButton.disabled = false;
    }, 1000);
  }
}

// 返信ボタンのイベント
function handleReply(messageId, content) {
  replyToId = messageId;
  document.getElementById("reply-text").textContent = content;
  replyPreview.classList.remove("hidden");
  messageInput.focus();
}

// 返信キャンセル
if (cancelReplyBtn) {
  cancelReplyBtn.addEventListener("click", () => {
    replyToId = null;
    replyPreview.classList.add("hidden");
  });
}

// メッセージ送信時に返信情報を含める
chatForm.addEventListener("submit", () => {
  let content = messageInput.value.trim();
  if (content !== "") {
    channel.push("new_message", { 
      message: content,
      reply_to: replyToId 
    });
    messageInput.value = "";
    messageInput.focus();
    // 返信情報をリセット
    replyToId = null;
    replyPreview.classList.add("hidden");
  }
});

// いいねの更新を受信
channel.on("message_liked", payload => {
  const { message } = payload;
  console.log("Received message_liked:", message); // デバッグ用
  updateMessageLikes(message.id, message.likes);
});

// メッセージ一覧を追加表示する
function appendMessages(msgList) {
  msgList.forEach(msg => {
    appendMessage(msg)
  })
}

// メッセージをエスケープする関数を追加
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 1つのメッセージを表示
function appendMessage(msg) {
  if (!messagesUL) return;
  
  const li = document.createElement("li");
  li.className = "bg-white p-4 rounded-lg shadow-sm";
  
  // 返信先のメッセージがある場合の表示
  const replyHtml = msg.reply_to_content ? `
    <div class="text-sm text-gray-500 bg-gray-50 p-2 rounded mb-2">
      <span class="font-medium">返信先 (ID: ${msg.reply_to_id}): </span>
      <span class="italic">${escapeHtml(msg.reply_to_content)}</span>
    </div>
  ` : '';

  li.innerHTML = `
    <div class="flex justify-between items-start">
      <div class="space-y-1">
        ${replyHtml}
        <p class="text-gray-900">${escapeHtml(msg.content)}</p>
        <div class="flex items-center space-x-4 mt-2">
          <button class="like-button text-gray-400 hover:text-pink-500 flex items-center space-x-1" data-message-id="${msg.id}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span class="likes-count">${msg.likes || 0}</span>
          </button>
          <button class="reply-button text-gray-400 hover:text-blue-500" data-message-id="${msg.id}" data-content="${escapeHtml(msg.content)}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
        </div>
      </div>
      <span class="text-sm text-gray-500">ID: ${msg.id}</span>
    </div>
  `;

  // いいねボタンのイベントリスナーを追加
  const likeButton = li.querySelector('.like-button');
  likeButton.addEventListener('click', () => {
    const messageId = parseInt(likeButton.dataset.messageId);
    handleLike(messageId);
  });

  // 返信ボタンのイベントリスナーを追加
  const replyButton = li.querySelector('.reply-button');
  replyButton.addEventListener('click', () => {
    const messageId = parseInt(replyButton.dataset.messageId);
    const content = replyButton.dataset.content;
    handleReply(messageId, content);
  });

  messagesUL.appendChild(li);
  messagesUL.scrollTop = messagesUL.scrollHeight;
}

// いいね数の更新
function updateMessageLikes(messageId, likes) {
  const likeButton = messagesUL.querySelector(`.like-button[data-message-id="${messageId}"]`);
  if (likeButton) {
    const likesCountSpan = likeButton.querySelector('.likes-count');
    if (likesCountSpan) {
      likesCountSpan.textContent = likes;
      
      // いいねアニメーション効果を追加
      likeButton.classList.add('text-pink-500');
      setTimeout(() => {
        likeButton.classList.remove('text-pink-500');
      }, 200);
    }
  }
}
