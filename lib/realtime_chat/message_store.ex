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
  def add_message(content, reply_to \\ nil) do
    GenServer.call(__MODULE__, {:add_message, content, reply_to})
  end

  @doc "全メッセージをリストで返す(新しい順でない点に注意)。"
  def get_messages() do
    GenServer.call(__MODULE__, :get_messages)
  end

  def add_like(message_id) do
    GenServer.call(__MODULE__, {:add_like, message_id})
  end

  # --- GenServer実装 ---

  @impl true
  def init(_init_arg) do
    {:ok, %{messages: [], next_id: 1}}
  end

  @impl true
  def handle_call(
        {:add_message, content, reply_to_id},
        _from,
        %{messages: messages, next_id: id} = state
      ) do
    # 返信先のメッセージを探す
    reply_to_message =
      if reply_to_id do
        Enum.find(messages, fn msg -> msg.id == reply_to_id end)
      end

    new_message = %{
      id: id,
      content: content,
      reply_to_id: reply_to_id,
      reply_to_content: if(reply_to_message, do: reply_to_message.content),
      likes: 0,
      timestamp: DateTime.utc_now()
    }

    {:reply, new_message, %{state | messages: [new_message | messages], next_id: id + 1}}
  end

  @impl true
  def handle_call({:add_like, message_id}, _from, %{messages: messages} = state) do
    {updated_message, updated_messages} =
      Enum.map_reduce(messages, [], fn
        %{id: ^message_id} = msg, acc ->
          updated = Map.update!(msg, :likes, &(&1 + 1))
          {updated, [updated | acc]}

        msg, acc ->
          {msg, [msg | acc]}
      end)

    {:reply, updated_message, %{state | messages: Enum.reverse(updated_messages)}}
  end

  @impl true
  def handle_call(:get_messages, _from, %{messages: messages} = state) do
    {:reply, messages, state}
  end
end
