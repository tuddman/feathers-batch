import async from 'async';

const paramsPositions = {
  find: 0,
  update: 2,
  patch: 2
};

function each (obj, cb) {
  Object.keys(obj).forEach(key => cb(obj[key], key));
}

function extend (target, ...others) {
  others.forEach(other => each(other, (val, prop) => (target[prop] = val)));
  return target;
}

export default function () {
  return {
    create (data, params) {
      let type = data.type || 'parallel';

      if (!Array.isArray(data.call) || !data.call.length) {
        return new Promise.resolve({ type, results: [] });
      }

      // async.series or async.parallel
      let process = async[type];

      if (!process) {
        return new Promise.reject(new Error(`Processing type "${data.type}" is not supported`));
      }

      let workers = data.call.map(call => {
        let args = call.slice(0);
        let [ path, method ] = args.shift().split('::');
        let service = this.app.service(path);
        let position = typeof paramsPositions[method] !== 'undefined'
          ? paramsPositions[method] : 1;

        return function () {

          let handler = function () {
            Promise.resolve(Array.prototype.slice.call(arguments));
          };

          if (!service) {
            return new Promise.reject(new Error(`Service ${path} does not exist`));
          }

          if (!method || typeof service[method] !== 'function') {
            Promise.reject(new Error(`Method ${method} on
              service ${path} does not exist`));
          }

          // Put the parameters into `query` and extend with original
          // service parameters (logged in user etc) just like a websocket call
          args[position] = extend({}, params, { query: args[position] });

          // Call the service method
          service[method](...args);
        };
      });

      process(workers, (error, data) => return new Promise((resolve, reject) => { 
		if (error) {
		  return reject(error);
		} 
		return resolve({ type, data });
	})
      );
    },

    setup (app) {
      this.app = app;
    }
  };
}
