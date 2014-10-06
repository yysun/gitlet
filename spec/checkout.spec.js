var fs = require("fs");
var g = require("../src/gitlet");
var testUtil = require("./test-util");

describe("checkout", function() {
  beforeEach(testUtil.initTestDataDir);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it("should throw if not in repo", function() {
    expect(function() { g.checkout(); })
      .toThrow("fatal: Not a gitlet repository (or any of the parent directories): .gitlet");
  });

  it("should throw if pass ref that does not resolve to a hash", function() {
    g.init();
    expect(function() { g.checkout("woo"); })
      .toThrow("error: pathspec woo did not match any file(s) known to gitlet.");
  });

  it("should throw if passed ref points to blob", function() {
    testUtil.createStandardFileStructure();
    g.init();
    g.add("1a/filea");
    g.commit({ m: "first" });
    expect(function() { g.checkout("5ceba65") })
      .toThrow("fatal: reference is not a tree: 5ceba65")
  });

  it("should throw if passed ref points to tree", function() {
    testUtil.createStandardFileStructure();
    g.init();
    g.add("1a/filea");
    g.commit({ m: "first" });
    expect(function() { g.checkout("17653b6d") })
      .toThrow("fatal: reference is not a tree: 17653b6d")
  });

  it("should throw if file has unstaged changes w/o common orig content with c/o", function() {
    testUtil.createStandardFileStructure();
    g.init();

    g.add("1a/filea");
    g.commit({ m: "first" });

    g.branch("other");

    fs.writeFileSync("1a/filea", "fileachange1");
    g.add("1a/filea");
    g.commit({ m: "second" });

    fs.writeFileSync("1a/filea", "fileachange2");

    expect(function() { g.checkout("other"); })
      .toThrow("error: Aborting. Your local changes to these files would be overwritten:\n" +
	             "1a/filea\n");
  });

  it("should throw if file has staged changes w/o common orig content with c/o", function() {
    testUtil.createStandardFileStructure();
    g.init();

    g.add("1a/filea");
    g.commit({ m: "first" });

    g.branch("other");

    fs.writeFileSync("1a/filea", "fileachange1");
    g.add("1a/filea");
    g.commit({ m: "second" });

    fs.writeFileSync("1a/filea", "fileachange2");
    g.add("1a/filea");

    expect(function() { g.checkout("other"); })
      .toThrow("error: Aborting. Your local changes to these files would be overwritten:\n" +
	             "1a/filea\n");
  });

  it("should list all files that would be overwritten when throwing", function() {
    testUtil.createStandardFileStructure();
    g.init();

    g.add("1a/filea");
    g.add("1b/fileb");
    g.add("1b/2b/filec");
    g.commit({ m: "first" });

    g.branch("other");

    fs.writeFileSync("1a/filea", "fileachange1");
    fs.writeFileSync("1b/fileb", "fileachange1");
    fs.writeFileSync("1b/2b/filec", "fileachange1");
    g.add("1a/filea");
    g.add("1b/fileb");
    g.add("1b/2b/filec");
    g.commit({ m: "second" });

    fs.writeFileSync("1a/filea", "fileachange2");
    fs.writeFileSync("1b/fileb", "fileachange2");
    fs.writeFileSync("1b/2b/filec", "fileachange2");

    expect(function() { g.checkout("other"); })
      .toThrow("error: Aborting. Your local changes to these files would be overwritten:\n" +
	             "1a/filea\n1b/fileb\n1b/2b/filec\n");
  });

  it("should not throw if file has changes w/ common orig content w/ c/o branch", function() {
    testUtil.createStandardFileStructure();
    g.init();

    g.add("1a/filea");
    g.commit({ m: "first" });

    g.branch("other");
    fs.writeFileSync("1a/filea", "fileachange2");

    g.checkout("other"); // does not throw
  });

  it("should keep uncommitted changes compatible w checked out branch", function() {
    testUtil.createStandardFileStructure();
    g.init();

    g.add("1a/filea");
    g.commit({ m: "first" });

    g.branch("other");
    fs.writeFileSync("1a/filea", "fileachange2");

    g.checkout("other");
    testUtil.expectFile("1a/filea", "fileachange2");
  });

  describe("successful checkout", function() {
    it("should remove committed files in previous working copy", function() {
      testUtil.createStandardFileStructure();
      g.init();

      g.add("1a/filea");
      g.commit({ m: "first" });
      g.branch("other");

      g.add("1b/fileb");
      g.commit({ m: "second" });

      g.checkout("other");
      expect(fs.existsSync("1b/fileb")).toEqual(false);
    });

    it("should add committed files in checked out ref", function() {
      testUtil.createStandardFileStructure();
      g.init();

      g.add("1a/filea");
      g.commit({ m: "first" });
      g.branch("other");

      g.add("1b/fileb");
      g.commit({ m: "second" });

      g.checkout("other");
      expect(fs.existsSync("1b/fileb")).toEqual(false); // sanity check

      g.checkout("master");
      expect(fs.existsSync("1b/fileb")).toEqual(true); // sanity check
    });

    it("should remove empty folders after checkout", function() {
      testUtil.createStandardFileStructure();
      g.init();

      g.add("1a/filea");
      g.commit({ m: "first" });
      g.branch("other");

      g.add("1b/2b/3b/4b/filed");
      g.commit({ m: "second" });

      g.checkout("other");
      expect(fs.existsSync("1b/2b/3b")).toEqual(false);
    });

    it("should not remove folders that have unindexed files", function() {
      testUtil.createStandardFileStructure();
      g.init();

      g.add("1a/filea");
      g.commit({ m: "first" });
      g.branch("other");

      g.add("1b/2b/3b/4b/filed");
      g.commit({ m: "second" });

      g.checkout("other");
      expect(fs.existsSync("1b/fileb")).toEqual(true);
    });

    it("should point head at checked out branch", function() {
      testUtil.createStandardFileStructure();
      g.init();

      g.add("1a/filea");
      g.commit({ m: "first" });
      g.branch("other");

      g.add("1b/fileb");
      g.commit({ m: "second" });

      g.checkout("other");
      testUtil.expectFile(".gitlet/HEAD", "ref: refs/heads/other");
    });

    it("should warn in detached head state if checkout commit", function() {
      testUtil.createStandardFileStructure();
      g.init();
      g.add("1a/filea");
      g.commit({ m: "first" });
      expect(g.checkout("21cb63f6"))
        .toEqual("Note: checking out 21cb63f6\nYou are in 'detached HEAD' state.");
    });
  });

  it("should allow a commit hash to be passed", function() {
    testUtil.createStandardFileStructure();
    g.init();

    g.add("1a/filea");
    g.commit({ m: "first" });
    g.add("1b/fileb");
    g.commit({ m: "second" });
    g.checkout("21cb63f6");
    testUtil.expectFile(".gitlet/HEAD", "21cb63f6");
  });

  it("should be able to exit detached head state", function() {
    testUtil.createStandardFileStructure();
    g.init();
    g.add("1a/filea");
    g.commit({ m: "first" });
    g.branch("other");
    g.add("1b/fileb");
    g.commit({ m: "second" });
    g.checkout("21cb63f6");
    g.checkout("other");
    testUtil.expectFile(".gitlet/HEAD", "ref: refs/heads/other");
  });

  describe("repeated checkout of same thing", function() {
    it("should be idempodent adds, dels, mods for branches", function() {
      testUtil.createStandardFileStructure();
      g.init();

      g.add("1a/filea");
      g.commit({ m: "first" });
      g.branch("other");

      fs.writeFileSync("1a/filea", "somethingelse");
      g.add("1a/filea");
      g.add("1b/fileb");
      g.commit({ m: "second" });

      g.checkout("other");
      g.checkout("other");
      testUtil.expectFile(".gitlet/HEAD", "ref: refs/heads/other");
      testUtil.expectFile("1a/filea", "filea");
      expect(fs.existsSync("1b/fileb")).toEqual(false);

      g.checkout("master");
      g.checkout("master");
      testUtil.expectFile(".gitlet/HEAD", "ref: refs/heads/master");
      testUtil.expectFile("1a/filea", "somethingelse");
      expect(fs.existsSync("1b/fileb")).toEqual(true);
    });

    it("should be idempodent adds, dels, mods for detached heads", function() {
      testUtil.createStandardFileStructure();
      g.init();
      g.add("1a/filea");
      g.commit({ m: "first" });
      fs.writeFileSync("1a/filea", "somethingelse");
      g.add("1a/filea");
      g.add("1b/fileb");
      g.commit({ m: "second" });

      g.checkout("21cb63f6");
      g.checkout("21cb63f6");
      testUtil.expectFile(".gitlet/HEAD", "21cb63f6");
      testUtil.expectFile("1a/filea", "filea");
      expect(fs.existsSync("1b/fileb")).toEqual(false);

      g.checkout("5c4868ac");
      g.checkout("5c4868ac");
      testUtil.expectFile(".gitlet/HEAD", "5c4868ac");
      testUtil.expectFile("1a/filea", "somethingelse");
      expect(fs.existsSync("1b/fileb")).toEqual(true);
    });
  });
});
