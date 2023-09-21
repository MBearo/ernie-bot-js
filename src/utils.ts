import { AxiosResponse } from "axios"
import { CompletionResponse } from "../index.js"

export function* streamJSON(string: string, removeString: string[]) {
    const list = string.split('\n\n').filter(v => v)
    for (const item of list) {
        try {
            const data = JSON.parse(item.replace(/^data: /, ''))
            if (data?.is_end && data?.result === '') {
                return
            }
            removeString.push(item + '\n\n')
            yield data
        } catch (error) {
            return
        }
    }
}
export function formateResponseStreamData(response: AxiosResponse) {
    let deferredResolve = Promise.resolve
    let lastString = ''
    response.data.on('data', async (data: string) => {
        const string = data.toString()
        lastString += string
        let removeString: string[] = []
        for await (const msg of streamJSON(lastString, removeString)) {
            deferredResolve({ value: msg, done: false })
        }
        lastString = lastString.slice(removeString.join('').length)
    })
    response.data.on('end', async () => {
        for await (const msg of streamJSON(lastString, [])) {
            deferredResolve({ value: msg, done: false })
        }
        deferredResolve({ value: {} as CompletionResponse, done: true })
    })
    response.data = {
        [Symbol.asyncIterator]() {
            return {
                next() {
                    return new Promise<{ value: CompletionResponse, done: boolean }>(resolve => {
                        deferredResolve = resolve as any
                    })
                }
            }
        }
    }
}
export function formateFetchStreamData() {

}

export function checkEnvironment() {
    if (typeof window !== 'undefined' && window.document) {
        return true; // running in a browser
        // @ts-ignore
    } else if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        return false; // running in Node.js
    }
    // According to your needs, decide what to return in case the environment is neither browser nor Node.js
}