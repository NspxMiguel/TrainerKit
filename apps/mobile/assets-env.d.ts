/** O dataset entra como ASSET, nao como JSON — ver a nota no `metro.config.js`. */
declare module "*.tkdata" {
  const id: number;
  export default id;
}
