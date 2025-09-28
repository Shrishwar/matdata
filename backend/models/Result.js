const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true,
    default: Date.now,
  },
  open3: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^\d{3}$/.test(v);
      },
      message: props => `${props.value} is not a valid 3-digit number!`
    }
  },
  close3: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^\d{3}$/.test(v);
      },
      message: props => `${props.value} is not a valid 3-digit number!`
    }
  },
  middle: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^\d{2}$/.test(v);
      },
      message: props => `${props.value} is not a valid 2-digit number!`
    }
  },
  double: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^\d{2}$/.test(v);
      },
      message: props => `${props.value} is not a valid 2-digit number!`
    }
  },
  finalNumber: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^\d{2}$/.test(v);
      },
      message: props => `${props.value} is not a valid 2-digit number!`
    }
  },
  source: {
    type: String,
    default: 'dpboss',
  },
  scrapedAt: {
    type: Date,
    default: Date.now,
  }
}, { timestamps: true });

// Virtuals for calculated fields
resultSchema.virtual('openSum').get(function() {
  return this.open3 ? this.open3.split('').reduce((sum, digit) => sum + parseInt(digit, 10), 0) : 0;
});

resultSchema.virtual('closeSum').get(function() {
  return this.close3 ? this.close3.split('').reduce((sum, digit) => sum + parseInt(digit, 10), 0) : 0;
});

resultSchema.virtual('openTens').get(function() {
  return this.open3 ? parseInt(this.open3[0], 10) : 0;
});

resultSchema.virtual('openUnits').get(function() {
  return this.open3 ? parseInt(this.open3[2], 10) : 0;
});

resultSchema.virtual('closeTens').get(function() {
  return this.close3 ? parseInt(this.close3[0], 10) : 0;
});

resultSchema.virtual('closeUnits').get(function() {
  return this.close3 ? parseInt(this.close3[2], 10) : 0;
});

resultSchema.virtual('doubleTens').get(function() {
  return this.double ? parseInt(this.double[0], 10) : 0;
});

resultSchema.virtual('doubleUnits').get(function() {
  return this.double ? parseInt(this.double[1], 10) : 0;
});

resultSchema.virtual('dayOfWeek').get(function() {
  return this.date ? this.date.getDay() : 0;
});

resultSchema.virtual('isWeekend').get(function() {
  return this.dayOfWeek === 0 || this.dayOfWeek === 6;
});

resultSchema.virtual('weekOfMonth').get(function() {
  return this.date ? Math.ceil((this.date.getDate() + this.date.getDay()) / 7) : 1;
});

resultSchema.virtual('digitRootOpen').get(function() {
  const sum = this.openSum;
  return sum > 0 ? (sum - 1) % 9 + 1 : 0;
});

resultSchema.virtual('digitRootClose').get(function() {
  const sum = this.closeSum;
  return sum > 0 ? (sum - 1) % 9 + 1 : 0;
});

// Ensure virtuals are included when converting to JSON
resultSchema.set('toJSON', { virtuals: true });
resultSchema.set('toObject', { virtuals: true });

// Index for faster lookups
resultSchema.index({ date: -1 });

const Result = mongoose.model('Result', resultSchema);

module.exports = Result;
