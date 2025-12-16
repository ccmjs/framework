ccm.files["ccm.dummy5.js"] = {
  name: "dummy5",
  ccm: "./libs/ccm/ccm.js",
  config: {},
  Instance: function () {
    this.start = (callback) => {
      this.started = true;
      callback();
    };
  },
};
