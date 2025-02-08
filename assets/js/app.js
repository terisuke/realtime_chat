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
import {Socket} from "phoenix"
import {LiveSocket} from "phoenix_live_view"
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
  .receive("ok", resp => { console.log("Joined chat:lobby successfully", resp) })
  .receive("error", resp => { console.log("Unable to join", resp) })

// DOM要素を取得
let sendBtn = document.getElementById("send-btn")
let messageInput = document.getElementById("message-input")
let messagesUL = document.getElementById("messages")

if (sendBtn && messageInput && messagesUL) {
  // 送信ボタンを押した時のイベント
  sendBtn.addEventListener("click", () => {
    let content = messageInput.value.trim()
    if (content !== "") {
      // チャンネルへ送信
      channel.push("new_message", { content: content })
      messageInput.value = ""
      messageInput.focus()
    }
  })
}

// メッセージ一覧を追加表示する
function appendMessages(msgList) {
  msgList.forEach(msg => {
    appendMessage(msg)
  })
}

// 1つのメッセージを表示
function appendMessage(msg) {
  if (!messagesUL) return
  let li = document.createElement("li")
  li.innerText = `[${msg.id}] ${msg.content}`
  messagesUL.appendChild(li)
}
