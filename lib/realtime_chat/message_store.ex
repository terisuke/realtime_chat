# lib/realtime_chat/message_store.ex
defmodule RealtimeChat.MessageStore do
  use GenServer

  @moduledoc """
  シンプルなメモリ内メッセージストア。
  アプリ起動中のみメッセージを保持する。
  """

  # --- 公開API ---

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, [], name: __MODULE__)
  end

  @doc "新しいメッセージを追加し、保存した構造を返す。"
  def add_message(content) do
    GenServer.call(__MODULE__, {:add_message, content})
  end

  @doc "全メッセージをリストで返す(新しい順でない点に注意)。"
  def get_messages() do
    GenServer.call(__MODULE__, :get_messages)
  end

  # --- GenServer実装 ---

  @impl true
  def init(_init_arg) do
    # stateにメッセージのリストを持つ
    {:ok, []}
  end

  @impl true
  def handle_call(:get_messages, _from, state) do
    {:reply, state, state}
  end

  @impl true
  def handle_call({:add_message, content}, _from, state) do
    # 一意なIDを生成する簡易例
    new_message = %{
      id: System.unique_integer([:positive]),
      content: content
    }

    new_state = [new_message | state]
    {:reply, new_message, new_state}
  end
end