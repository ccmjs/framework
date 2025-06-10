ccm.files["ccm.dummy2.js"] = {
  name: "dummy2",
  ccm: "./../ccm.js",
  config: {},
  Instance: function () {
    this.start = async () => (this.started = true);
  },
};
