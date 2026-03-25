import { useChatStore } from "../store/chatStore"

//自定义hook必须以use开头
export function useChat (){
    return useChatStore()
}
