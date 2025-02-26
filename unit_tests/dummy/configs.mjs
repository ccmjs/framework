export const base = {
  foo: "baz",
  val: false,
};
export const config = {
  config: ["ccm.load", "./dummy/configs.mjs#base"],
  val: true,
};
