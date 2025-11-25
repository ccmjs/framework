export const component = {
  name: "dummy2",
  ccm: "./../ccm.js",
  config: {},
  Instance: function () {
    this.start = async () => (this.started = true);
  },
};
