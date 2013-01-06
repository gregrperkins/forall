var should = require('should');
var forAll = require('./forall');
var sinon = require('sinon');

describe('forAll.TimeoutError', function() {
  var err = new forAll.TimeoutError();
  it('should be an instance of Error', function() {
    err.should.be.an.instanceOf(Error);
  });
});

describe('forAll.ForkError', function() {
  var err = new forAll.ForkError();
  it('should be an instance of Error', function() {
    err.should.be.an.instanceOf(Error);
  });
});

describe('forAll', function() {
  before(function() {
    this.clock = sinon.useFakeTimers('setTimeout');
  });

  after(function() {
    this.clock.restore();
  });

  it('is a function', function() {
    forAll.should.be.a('function');
  });

  it('acts somewhat like forEach', function(doneIt) {
    var input = [0,1,2];
    var output = [];
    var dis = {};
    forAll(input, function(done, x, i) {
      // Get the value and index
      x.should.equal(i);
      // Context should be used
      this.should.equal(dis);
      output[i] = x;
      done();
    }, function(err) {
      // All the functions should have been called
      output.should.eql(input);
      doneIt(err);
    }, {
      context: dis
    });
  });

  it('accepts an unused timeout', function(doneIt) {
    var input = [0,1,2];
    forAll(input, function(done, x, i) {
      // Synchronous, single-threaded, no possibility for timeout
      done();
    }, function(err) {
      // Wait until after the timeout would have called
      setTimeout(function(){
        doneIt(err);
      }, 3);
    }, {
      timeout: 2
    });
    this.clock.tick(10);
  });

  it('works asynchronously', function(doneIt) {
    var input = [0,1,2];
    var output = [];
    forAll(input, function(done, x, i) {
      // Asynchronous array copy
      // Wait i milliseconds before doing it
      setTimeout(function() {
        output[i] = x;
        done();
      }, i);
    }, function(err) {
      output.should.eql(input);
      doneIt(err);
    });
    this.clock.tick(10);
  });

  it('propagates an error', function(doneIt) {
    var input = [0,1,2];
    var output = [];
    var msg = 'no counting allowed!';
    forAll(input, function(done, x, i) {
      setTimeout(function() {
        done(x > 0 ? Error(msg) : null);
        output[i] = x;
      }, x);
    }, function(err) {
      should.exist(err);
      err.message.should.equal(msg);
      // Should only have copied 0
      output.should.eql([0]);
      // Mocha checks that we only call doneIt once.
      doneIt();
    }, {
      timeout: 3
    });
    this.clock.tick(10);
  });

  it('does not allow forks', function(doneIt) {
    var input = [0,2];
    // We expect:
    // Time   0ms      1ms              2ms
    //        |--------|----------------|
    // Events  0A      0B, 1B           1A
    forAll(input, function(done, x, i) {
      setTimeout(function() {
        done(); // A
      }, x);
      setTimeout(function() {
        done(); // B
      }, 1);
    }, function(err) {
      should.exist(err);
      err.should.be.instanceOf(forAll.ForkError);
      err.index.should.equal(0);
      err.item.should.equal(0);
      doneIt();
    });
    this.clock.tick(10);
  });

  it('times out properly', function(doneIt) {
    var input = [0,2,4];
    // We expect:
    // Time   0ms  1ms  2ms  3ms  4ms
    //        |----|----|----|----|
    // Events  0        1    T    2
    forAll(input, function(done, x, i) {
      // This time, wait x ms between copies
      // That way we get a timeline of sorts
      setTimeout(function() {
        done();
      }, x);
    }, function(err) {
      should.exist(err);
      err.should.be.an.instanceOf(forAll.TimeoutError);
      err.status.should.eql([
        // First two should be done (0 & 2)
        forAll.STATUS.DONE,
        forAll.STATUS.DONE,
        // Last one takes 4 ms, but timeout at 3 ms
        forAll.STATUS.RUNNING,
      ]);
      // Mocha checks that we only call doneIt once.
      doneIt();
    }, {
      timeout: 3
    });
    this.clock.tick(10);
  });
});
