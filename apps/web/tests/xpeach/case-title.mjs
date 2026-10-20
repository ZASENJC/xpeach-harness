// Brand surface: title, no key errors at boot.
export const name = 'brand: title + zero page errors'
export async function run(page, errors) {
  const title = await page.title()
  if (!/XPeach|🍑/.test(title)) throw new Error('title: ' + title)
  if (errors.length) throw new Error('pageerrors: ' + errors.slice(0, 3).join(' || '))
}
