export function* streamJSON(string: string, removeString: string[]) {
    const list = string.split('\n\n').filter(v => v)
    for (const item of list) {
        try {
            const data = JSON.parse(item.replace(/^data: /, ''))
            if (data?.is_end) {
                return
            }
            removeString.push(item + '\n\n')
            yield data
        } catch (error) {
            return
        }
    }
}