# RealtimeChat

[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

このリポジトリは、Elixir/Phoenix を使ってシンプルなリアルタイムチャット機能を実装したサンプルプロジェクトです。
Phoenix の Channels 機能を用いて、WebSocket でクライアント間のメッセージをやり取りします。メッセージの一時保存には、Elixir の GenServer を使用しており、起動中のみメモリに保持されます（データベースへの永続化は行っていません）。

## 主な機能

1.  **リアルタイムチャット**
    *   WebSocket を通してメッセージを送受信し、ページをリロードすることなく更新が反映されます。
2.  **リプライ機能**
    *   あるメッセージに対して返信（引用リプライ）を行うと、返信元メッセージの内容を表示します。
3.  **いいね (Like) 機能**
    *   各メッセージに対して「いいね」を押せます。即座に全クライアントの表示が更新されます。
4.  **Phoenix Channels × GenServer = 高並行 & 耐障害性**
    *   OTP（Erlang/Elixir の標準並行フレームワーク）により、大量の接続やクラッシュ耐性を簡潔に扱うことができます。

## 動作環境

*   Elixir ~> 1.14 (1.14.0 以上推奨)
*   Phoenix ~> 1.7
*   Node.js (Tailwind / esbuild などのアセットビルド用)

## セットアップ & 起動方法

```bash
# 1. リポジトリをクローン
git clone https://github.com/your-account/realtime_chat.git
cd realtime_chat

# 2. 依存関係をインストール
mix deps.get

# 3. アセットをセットアップ & ビルド
mix assets.setup
mix assets.build

# 4. サーバ起動
mix phx.server
```

ブラウザで [http://localhost:4000](http://localhost:4000) を開くと、トップページにチャット画面が表示されます。

## ディレクトリ構成

以下は主要ファイルの構成です（一部省略）。

```
├── assets/
│   ├── js/
│   │   └── app.js          # フロントエンドのチャット機能を実装 (メイン)
│   └── ...
├── config/
│   └── dev.exs            # 開発環境設定
├── lib/
│   ├── realtime_chat/
│   │   ├── application.ex # OTPアプリケーションのエントリ (Supervisor)
│   │   ├── message_store.ex # GenServerでメッセージをメモリ管理
│   ├── realtime_chat_web/
│   │   ├── channels/
│   │   │   └── chat_channel.ex # "chat:lobby"のChannel実装
│   │   ├── endpoint.ex    # Phoenix Endpoint ("/socket" 等)
│   │   ├── user_socket.ex # WebSocketエントリ
│   │   └── controllers/
│   │       └── page_controller.ex   # "/" (ホーム画面)
│   │   └── ...
│   └── realtime_chat.ex   # ルートモジュール（コンテキスト定義）
└── ...
```

## 主要コード解説

### 1. GenServer でメッセージを保持する: MessageStore

```elixir
# lib/realtime_chat/message_store.ex
defmodule RealtimeChat.MessageStore do
  use GenServer

  @doc """
  シンプルなメモリ内メッセージストア。
  アプリ起動中のみメッセージを保持する。
  """

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, [], name: __MODULE__)
  end

  @doc "新しいメッセージを追加し、保存した構造を返す。"
  def add_message(content, reply_to \\ nil) do
    GenServer.call(__MODULE__, {:add_message, content, reply_to})
  end

  @doc "全メッセージを取得。"
  def get_messages() do
    GenServer.call(__MODULE__, :get_messages)
  end

  @doc "指定IDのメッセージに「いいね」を1回追加。"
  def add_like(message_id) do
    GenServer.call(__MODULE__, {:add_like, message_id})
  end

  @impl true
  def init(_init_arg) do
    # messages: メッセージ一覧, next_id: 次に発行するメッセージID
    {:ok, %{messages: [], next_id: 1}}
  end

  @impl true
  def handle_call({:add_message, content, reply_to_id}, _from, state) do
    messages = state.messages
    next_id = state.next_id

    # 返信対象のメッセージがあれば取得
    reply_to_message =
      if reply_to_id do
        Enum.find(messages, fn msg -> msg.id == reply_to_id end)
      end

    new_message = %{
      id: next_id,
      content: content,
      reply_to_id: reply_to_id,
      reply_to_content: reply_to_message && reply_to_message.content,
      likes: 0,
      timestamp: DateTime.utc_now()
    }

    new_state = %{
      state
      | messages: [new_message | messages],
        next_id: next_id + 1
    }

    {:reply, new_message, new_state}
  end

  @impl true
  def handle_call({:add_like, message_id}, _from, state) do
    {updated_message, updated_messages} =
      Enum.map_reduce(state.messages, [], fn msg, acc ->
        if msg.id == message_id do
          new_msg = Map.update!(msg, :likes, &(&1 + 1))
          {new_msg, [new_msg | acc]}
        else
          {msg, [msg | acc]}
        end
      end)

    # `map_reduce` で逆順に加工されたメッセージを再逆転 (Enum.reverse)
    new_state = %{state | messages: Enum.reverse(updated_messages)}
    {:reply, updated_message, new_state}
  end

  @impl true
  def handle_call(:get_messages, _from, state) do
    {:reply, state.messages, state}
  end
end
```

*   メモリ上でメッセージをリスト管理しており、DB は使っていません。
*   `add_message/2` / `get_messages/0` / `add_like/1` を通じて、メッセージの投稿やいいねが行われます。
*   Supervisor により 自動再起動が行われるため、クラッシュ時にもアプリ全体が落ちることはありません。

### 2. OTPアプリケーション & Supervisor: application.ex

```elixir
# lib/realtime_chat/application.ex
defmodule RealtimeChat.Application do
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      RealtimeChatWeb.Telemetry,
      {DNSCluster, query: Application.get_env(:realtime_chat, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: RealtimeChat.PubSub},
      {Finch, name: RealtimeChat.Finch},
      {RealtimeChat.MessageStore, []},  # ★ここでMessageStoreを監視対象に
      RealtimeChatWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: RealtimeChat.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
```

*   `MessageStore` が Supervisor の `children` に登録され、OTP フレームワークによりプロセス管理されます。

### 3. Channel 実装: ChatChannel

```elixir
# lib/realtime_chat_web/channels/chat_channel.ex
defmodule RealtimeChatWeb.ChatChannel do
  use RealtimeChatWeb, :channel
  alias RealtimeChat.MessageStore

  @impl true
  def join("chat:lobby", _payload, socket) do
    # 参加と同時に :after_join メッセージを自分自身に送信
    send(self(), :after_join)
    {:ok, socket}
  end

  @impl true
  def handle_info(:after_join, socket) do
    # 既存メッセージを取得してクライアントに送る
    all_messages = MessageStore.get_messages()
    push(socket, "load_messages", %{messages: Enum.reverse(all_messages)})
    {:noreply, socket}
  end

  # 新規メッセージ受信
  @impl true
  def handle_in("new_message", %{"message" => content, "reply_to" => reply_to}, socket) do
    msg = MessageStore.add_message(content, reply_to)
    broadcast!(socket, "new_message", %{message: msg})
    {:noreply, socket}
  end

  # クライアントからの「履歴を取得してほしい」リクエスト
  @impl true
  def handle_in("get_messages", _params, socket) do
    all_messages = MessageStore.get_messages()
    push(socket, "load_messages", %{messages: Enum.reverse(all_messages)})
    {:noreply, socket}
  end

  # いいね機能
  @impl true
  def handle_in("like_message", %{"message_id" => message_id}, socket)
      when is_binary(message_id) do
    case Integer.parse(message_id) do
      {id, _} ->
        updated = MessageStore.add_like(id)
        broadcast!(socket, "message_liked", %{message: updated})
        {:reply, :ok, socket}

      _ ->
        {:reply, {:error, %{reason: "invalid message id"}}, socket}
    end
  end
    @impl true
    def handle_in("like_message", %{"message_id" => message_id}, socket)
        when is_integer(message_id) do
      updated = MessageStore.add_like(message_id)
      broadcast!(socket, "message_liked", %{message: updated})
      {:reply, :ok, socket}
    end
end
```

*   クライアントは `"chat:lobby"` チャンネルに join すると、まず `handle_info(:after_join, ...)` により既存メッセージが送られます。
*   `"new_message"` や `"like_message"` といったイベントを受信すると、`MessageStore` に書き込み、`broadcast!` で全クライアントに通知。

### 4. Socket (UserSocket) 設定

```elixir
# lib/realtime_chat_web/user_socket.ex
defmodule RealtimeChatWeb.UserSocket do
  use Phoenix.Socket

  channel "chat:lobby", RealtimeChatWeb.ChatChannel

  @impl true
  def connect(_params, socket, _connect_info) do
    {:ok, socket}
  end

  @impl true
  def id(_socket), do: nil
end
```

*   `"/socket"` への接続が来たら、`UserSocket` を通して `"chat:lobby"` チャンネルにマッピングされます。
*   認証を追加したい場合は、`connect` 内で JWT チェックなどを行うことも可能です。

### 5. フロントエンド: app.js

```javascript
// assets/js/app.js

import "phoenix_html"
import { Socket } from "phoenix"
import { LiveSocket } from "phoenix_live_view" // LiveView を使わない場合はこの行は不要
import topbar from "../vendor/topbar"

// --- 省略：LiveViewの初期化部分 (LiveView を使わない場合はこの部分は不要) ---

// Phoenixソケットへの接続
let socket = new Socket("/socket", { params: {} })
socket.connect()

// "chat:lobby"チャンネルに参加
let channel = socket.channel("chat:lobby", {})

// 過去メッセージを一括受信
channel.on("load_messages", payload => {
  let messages = payload.messages
  console.log("Loaded messages:", messages)
  appendMessages(messages)
})

// 新規メッセージ
channel.on("new_message", payload => {
  let { message } = payload
  console.log("Received new_message:", message)
  appendMessage(message)
})

// いいね
channel.on("message_liked", payload => {
  const { message } = payload
  console.log("Received message_liked:", message)
  updateMessageLikes(message.id, message.likes)
})

// チャンネル参加完了後、"get_messages" イベントを送って履歴を要求
channel.join()
  .receive("ok", () => {
    console.log("Successfully joined chat")
    channel.push("get_messages")
  })
  .receive("error", resp => { console.log("Unable to join", resp) })

// DOM要素
let chatForm = document.getElementById("chat-form")
let messageInput = document.getElementById("message-input")
let messagesUL = document.getElementById("messages")
let replyPreview = document.getElementById("reply-preview")
let cancelReplyBtn = document.getElementById("cancel-reply")
let replyToId = null

chatForm.addEventListener("submit", () => {
  let content = messageInput.value.trim()
  if (content !== "") {
    channel.push("new_message", {
      message: content,
      reply_to: replyToId
    })
    messageInput.value = ""
    replyToId = null
    replyPreview.classList.add("hidden")
  }
})

// いいねボタンを押したとき
function handleLike(messageId) {
  channel.push("like_message", { message_id: messageId })
    .receive("ok", () => {
      console.log("Like successful")
    })
    .receive("error", (err) => {
      console.error("Like failed:", err)
    })
}

// 返信ボタンを押したとき
function handleReply(messageId, content) {
  replyToId = messageId
  document.getElementById("reply-text").textContent = content
  replyPreview.classList.remove("hidden")
  messageInput.focus()
}

if (cancelReplyBtn) {
  cancelReplyBtn.addEventListener("click", () => {
    replyToId = null
    replyPreview.classList.add("hidden")
  })
}

// メッセージ一覧追加
function appendMessages(msgList) {
  msgList.forEach(msg => {
    appendMessage(msg)
  })
}

// メッセージ一件追加
function appendMessage(msg) {
  if (!messagesUL) return
  const li = document.createElement("li")
  // 返信先がある場合のUI
  const replyHtml = msg.reply_to_content
    ? `<div class="text-sm text-gray-500 bg-gray-50 p-2 rounded mb-2">
         <span class="font-medium">返信先 (ID: ${msg.reply_to_id}): </span>
         <span class="italic">${escapeHtml(msg.reply_to_content)}</span>
       </div>`
    : ""

  li.innerHTML = `
    <div class="bg-white p-4 rounded-lg shadow-sm mb-2">
      ${replyHtml}
      <p class="text-gray-900">${escapeHtml(msg.content)}</p>
      <div class="flex items-center space-x-4 mt-2">
        <button class="like-button" data-message-id="${msg.id}">❤️ <span>${msg.likes || 0}</span></button>
        <button class="reply-button" data-message-id="${msg.id}" data-content="${escapeHtml(msg.content)}">↩️</button>
        <span class="text-sm text-gray-500">ID: ${msg.id}</span>
      </div>
    </div>
  `
  messagesUL.appendChild(li)

  // イベントを付与
  li.querySelector(".like-button").addEventListener("click", () => {
    handleLike(msg.id)
  })
  li.querySelector(".reply-button").addEventListener("click", () => {
    handleReply(msg.id, msg.content)
  })
}

// いいね数を更新
function updateMessageLikes(messageId, likes) {
  let likeButtons = document.querySelectorAll(`.like-button[data-message-id="${messageId}"]`)
  likeButtons.forEach(btn => {
    let span = btn.querySelector("span")
    if (span) { span.textContent = likes }
  })
}

// HTMLエスケープ
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
```

*   `channel.push("new_message", {...})` で新規メッセージを送信すると、サーバの `handle_in("new_message", ...)` が処理します。
*   返信ボタン・いいねボタンの押下時も、対応するイベント (`like_message`) がサーバに送信され、その結果は全クライアントに通知されます。

### 6. テンプレート (HTML)

```html
<!-- lib/realtime_chat_web/controllers/page_html/home.html.heex -->
<div class="min-h-screen bg-gray-50 py-8">
  <div class="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
    <div class="bg-white rounded-lg shadow">
      <div class="p-6">
        <h1 class="text-2xl font-bold text-gray-900 mb-8">Phoenix リアルタイムチャット</h1>

        <!-- メッセージ表示エリア -->
        <div class="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-6 h-[500px] overflow-y-auto">
          <ul id="messages" class="space-y-4">
            <!-- JS で動的に li を追加 -->
          </ul>
        </div>

        <!-- リプライ時のプレビュー -->
        <div id="reply-preview" class="hidden mb-4 p-3 bg-gray-100 rounded-md">
          <div class="flex justify-between items-center">
            <p class="text-sm text-gray-600">
              <span class="font-medium">返信先: </span>
              <span id="reply-text" class="italic"></span>
            </p>
            <button id="cancel-reply" class="text-gray-400 hover:text-gray-600">
              <!-- × アイコン -->
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        </div>

        <!-- 入力エリア -->
        <form id="chat-form" class="flex gap-3" onsubmit="return false;">
          <input
            type="text"
            id="message-input"
            class="flex-1 rounded-md border-gray-300 shadow-sm ..."
            placeholder="メッセージを入力..."
          />
          <button
            type="submit"
            id="send-btn"
            class="rounded-md bg-indigo-600 px-6 py-2 text-base text-white..."
          >
            送信
          </button>
        </form>
      </div>
    </div>
  </div>
</div>
```

*   Bootstrap や Tailwind などのCSSフレームワークと合わせれば、少ないコード量でUIを整えられるのが魅力です。

## Elixir/Phoenix ならではのポイント

*   **GenServer × Supervisor**
    *   耐障害性の高いサーバを少ないコードで実装。
    *   クラッシュしてもすぐに再起動し、サービスを継続できます。
*   **パターンマッチ & イミュータブルデータ**
    *   コードが読みやすく、並行処理での競合も起きにくい。
*   **Channels を使ったリアルタイム通信**
    *   Phoenix が標準で WebSocket による PubSub 機能を提供。
    *   大量接続やスケーリングに強い設計が可能。
*   **OTP による分散・拡張**
    *   DNSCluster などを使えば、複数ノードで分散してチャットを運用することも容易です。

## 今後の拡張案

1.  **データベース永続化**
    *   メッセージを DB (Postgres など) に保存すれば、サーバが再起動しても履歴が残ります。
    *   Phoenix + Ecto で統合するか、Supabase のような外部サービスを利用するなどが簡単です。
2.  **ユーザー認証 & ログイン機能**
    *   `connect/3` や `handle_in/3` で JWT をチェックし、ユーザー毎の表示名やプロフィール画像を扱うこともできます。
3.  **Presence (オンラインユーザー一覧) の導入**
    *   Phoenix には Presence が標準搭載されており、チャット参加者の状態をリアルタイムに管理できます。
4.  **GUI・UI強化**
    *   今回はTailwindでシンプルに構築していますが、React/Vue/Svelteなど好きなフロントエンドフレームワークと組み合わせも可能です。

## ライセンス

[MIT License](https://opensource.org/licenses/MIT)

## おわりに

Elixir と Phoenix を組み合わせることで、並行処理・リアルタイム通信・クラッシュ耐性などを非常にシンプルに実現できます。
このサンプルをベースに、ユーザー管理やデータベース連携を加えれば、本格的なチャットアプリやリアルタイムダッシュボードを構築できます。
ぜひ自由にカスタマイズしてみてください。
