export const base = {
  val: true,
  arr: [1, 2, 3],
};
export const config = {
  config: ["ccm.load", "./dummy/configs.mjs#base"],
  "arr.2": 4,
  "obj.foo": "baz",
};
