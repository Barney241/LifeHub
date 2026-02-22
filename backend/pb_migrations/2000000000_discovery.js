migrate((app) => {
  console.log("--- DISCOVERY ---");
  console.log("app keys:", Object.keys(app).join(", "));
  try {
    const test = new TextField({name: "test"});
    console.log("TextField constructor exists");
  } catch(e) {
    console.log("TextField constructor NOT found");
  }
  console.log("globals:", Object.keys(this).join(", "));
  console.log("-----------------");
}, (app) => {})
