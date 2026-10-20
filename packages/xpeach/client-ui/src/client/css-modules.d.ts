/** ambient declarations for css module imports inside client bundles. */
declare module '*.module.css' {
  const styles: { readonly [key: string]: string }
  export default styles
}
