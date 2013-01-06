var util = require('util');

var exports = module.exports = forAll;

/** @enum {string} */
var STATUS = exports.STATUS = {
  DONE: 'done',
  RUNNING: 'running',
  ERROR: 'error'
};

/**
 * An error thrown when a forAll call times out.
 *
 * @param {Array.<STATUS>} status, The status for each of the actions.
 *
 * @constructor
 * @extends {Error}
 * @api public
 */
var TimeoutError = exports.TimeoutError = function(status) {
  this.name = 'TimeoutError';
  this.message = 'forAll timeout exceeded.';
  this.status = status;
};
util.inherits(TimeoutError, Error);


/**
 * An error thrown when a single action calls done() multiple times.
 *
 * @param {number} index, The index at which the duplicate call was encountered
 * @param {*} item, The item at which ``
 *
 * @constructor
 * @extends {Error}
 * @api public
 */
var ForkError = exports.ForkError = function(index, item) {
  this.name = 'ForkError';
  this.message = 'Multiple done() calls in forAll action';
  this.index = index;
  this.item = item;
};
util.inherits(ForkError, Error);


/**
 * Apply defaults to options
 * @param {Object} options
 * @return {Object} transformed options
 * @api private
 */
function getOptions(options) {
  var opts = {};
  options = options || {};
  opts.timeout = options.timeout;
  opts.context = options.context;
  return opts;
};

/**
 * Calls the given action function for each element of the array.
 *  Calls the callback when finished if any error occurred.
 * Optionally, can call the actions within a context object,
 *  or apply a timeout to the entire operation.
 *
 * @param {Array.<T>} array
 * @param {function(function(Error=), T, number)} action
 * @param {function(Error=)} callback
 * @param {{timeout: number=, context: Object=}} options
 * @api public
 */
function forAll(array, action, callback, options) {
  options = getOptions(options);

  // At first, we have no pending actions
  var pending = 0;
  // If we callback with an error, keep track here
  var errored = false;
  // If we timeout, keep track here
  var timedOut = false;

  function errback(err) {
    // Only want to error out once
    if (errored) {
      return;
    }

    errored = true;
    callback(err);
  };

  function okback() {
    if (errored || timedOut) {
      return;
    }
    if (pending === 0) {
      callback(null);
    }
  };

  function timeback() {
    // If there is nothing pending, we're already done.
    if (errored || pending === 0) {
      return;
    }
    // Account for the timeout
    timedOut = true;
    // If appropriate, callback with an error
    errback(new TimeoutError(status));
  };

  // Start the timeout counter.
  if (options.timeout) {
    setTimeout(timeback, options.timeout);
  }

  // Keep track of the status of all our running actions
  var status = [];
  // For the duration of our forEach, indicate a pending operation
  // (this allows action functions to call done synchronously)
  ++pending;
  // Run the action for each item
  array.forEach(function(item, index) {
    var done = function(err){
      // Do nothing once we've timed out.
      if (timedOut) {
        return;
      }

      // This means we got multiple done() calls from a single action() call
      if (status[index] != STATUS.RUNNING) {
        // Construct and possibly callback with an error message
        errback(new ForkError(index, item));
        // Need to return to prevent decrementing pending a second time
        return;
      }

      // Update our pending function accounting
      --pending;
      // Update the status map
      status[index] = err ? STATUS.ERROR : STATUS.DONE;
      // Possibly handle an error or make the callback
      err ? errback(err) : okback();
    };

    // Indicate that we have one more outstanding function.
    ++pending;
    status[index] = STATUS.RUNNING;

    // Call the action function, with the first argument as our done indicator
    action.call(options.context, done, item, index);
  });

  // If all of the action() functions called done() syncronously, we may need
  //  to call the callback.
  --pending;
  okback();
};
