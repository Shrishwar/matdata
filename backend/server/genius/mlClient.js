const { PythonShell } = require('python-shell');
const path = require('path');
const config = require('./config');

class MLClient {
  async predict(features) {
    return new Promise((resolve, reject) => {
      const options = {
        mode: 'json',
        pythonPath: 'python3', // or 'python' depending on system
        scriptPath: path.join(__dirname, '../../../scripts'),
        args: [JSON.stringify(features)]
      };

      PythonShell.run('predict.py', options, (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results[0] || []);
        }
      });
    });
  }

  async explain(features) {
    return new Promise((resolve, reject) => {
      const options = {
        mode: 'json',
        pythonPath: 'python3',
        scriptPath: path.join(__dirname, '../../../scripts'),
        args: [JSON.stringify(features)]
      };

      PythonShell.run('explain.py', options, (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results[0] || {});
        }
      });
    });
  }

  async train() {
    return new Promise((resolve, reject) => {
      const options = {
        mode: 'json',
        pythonPath: 'python3',
        scriptPath: path.join(__dirname, '../../../scripts'),
        args: []
      };

      PythonShell.run('train_model.py', options, (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results[0] || {});
        }
      });
    });
  }
}

module.exports = new MLClient();
