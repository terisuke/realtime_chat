import { Socket } from "phoenix"
import "phoenix_html"
import { LiveSocket } from "phoenix_live_view"
import topbar from "../vendor/topbar"

let csrfToken = document.querySelector("meta[name='csrf-token']").getAttribute("content")
let liveSocket = new LiveSocket("/live", Socket, {
  longPollFallbackMs: 2500,
  params: {_csrf_token: csrfToken}
})

topbar.config({barColors: {0: "#29d"}, shadowColor: "rgba(0, 0, 0, .3)"})
window.addEventListener("phx:page-loading-start", _info => topbar.show(300))
window.addEventListener("phx:page-loading-stop", _info => topbar.hide())

liveSocket.connect()

window.liveSocket = liveSocket

let socket = new Socket("/socket", {params: {}})
socket.connect()

let channel = socket.channel("chat:lobby", {})

channel.on("load_messages", payload => {
  let messages = payload.messages
  console.log("Loaded messages:", messages)
  appendMessages(messages)
})

channel.on("new_message", payload => {
  let { message } = payload
  console.log("Received new_message:", message)
  appendMessage(message)
})

channel.join()
  .receive("ok", () => {
    console.log("Successfully joined chat")
    channel.push("get_messages")
  })
  .receive("error", resp => { console.log("Unable to join", resp) })

let chatForm = document.getElementById("chat-form")
let messageInput = document.getElementById("message-input")
let messagesUL = document.getElementById("messages")

let replyToId = null;
let replyPreview = document.getElementById("reply-preview");
let cancelReplyBtn = document.getElementById("cancel-reply");

function handleLike(messageId) {
  const likeButton = messagesUL.querySelector(`.like-button[data-message-id="${messageId}"]`);
  if (likeButton) {
    likeButton.disabled = true;
    
    channel.push("like_message", { message_id: messageId })
      .receive("ok", () => {
        console.log("Like successful");
      })
      .receive("error", (err) => {
        console.error("Like failed:", err);
        likeButton.disabled = false;
      });
      
    setTimeout(() => {
      likeButton.disabled = false;
    }, 1000);
  }
}

function handleReply(messageId, content) {
  replyToId = messageId;
  document.getElementById("reply-text").textContent = content;
  replyPreview.classList.remove("hidden");
  messageInput.focus();
}

if (cancelReplyBtn) {
  cancelReplyBtn.addEventListener("click", () => {
    replyToId = null;
    replyPreview.classList.add("hidden");
  });
}

chatForm.addEventListener("submit", () => {
  let content = messageInput.value.trim();
  if (content !== "") {
    channel.push("new_message", { 
      message: content,
      reply_to: replyToId 
    });
    messageInput.value = "";
    messageInput.focus();
    replyToId = null;
    replyPreview.classList.add("hidden");
  }
});

channel.on("message_liked", payload => {
  const { message } = payload;
  console.log("Received message_liked:", message);
  updateMessageLikes(message.id, message.likes);
});

function appendMessages(msgList) {
  msgList.forEach(msg => {
    appendMessage(msg)
  })
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function appendMessage(msg) {
  if (!messagesUL) return;
  
  const li = document.createElement("li");
  li.className = "bg-white p-4 rounded-lg shadow-sm";
  
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

  const likeButton = li.querySelector('.like-button');
  likeButton.addEventListener('click', () => {
    const messageId = parseInt(likeButton.dataset.messageId);
    handleLike(messageId);
  });

  const replyButton = li.querySelector('.reply-button');
  replyButton.addEventListener('click', () => {
    const messageId = parseInt(replyButton.dataset.messageId);
    const content = replyButton.dataset.content;
    handleReply(messageId, content);
  });

  messagesUL.appendChild(li);
  messagesUL.scrollTop = messagesUL.scrollHeight;
}

function updateMessageLikes(messageId, likes) {
  const likeButton = messagesUL.querySelector(`.like-button[data-message-id="${messageId}"]`);
  if (likeButton) {
    const likesCountSpan = likeButton.querySelector('.likes-count');
    if (likesCountSpan) {
      likesCountSpan.textContent = likes;
      
      likeButton.classList.add('text-pink-500');
      setTimeout(() => {
        likeButton.classList.remove('text-pink-500');
      }, 200);
    }
  }
}

// クラッシュテスト用のボタンを追加
const crashTestBtn = document.createElement("button")
crashTestBtn.textContent = "クラッシュテスト実行"
crashTestBtn.className = "bg-red-500 text-white px-4 py-2 rounded"
crashTestBtn.onclick = () => {
  console.log("クラッシュテストを実行...")
  channel.push("crash_test")
    .receive("error", () => {
      console.log("チャンネルがクラッシュしました")
      
      // クラッシュ後にチャンネルが復帰したことを確認
      setTimeout(() => {
        channel.push("ping")
          .receive("ok", response => {
            console.log("チャンネルが復帰しました:", response)
          })
      }, 1000)
    })
}
document.querySelector("#chat-form").appendChild(crashTestBtn)
