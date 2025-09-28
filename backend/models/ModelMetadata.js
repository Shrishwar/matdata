const mongoose = require('mongoose');

const modelMetadataSchema = new mongoose.Schema({
  version: {
    type: String,
    required: true,
    unique: true
  },
  metrics: {
    accuracy: Number,
    top1_acc: Number,
    top3_acc: Number,
    top5_acc: Number,
    log_loss: Number,
    brier_score: Number
  },
  trainedAt: {
    type: Date,
    default: Date.now
  },
  artifactPath: {
    type: String,
    required: true
  },
  featureList: [String],
  shapExplainerPath: String,
  cvScores: [{
    accuracy: Number,
    log_loss: Number,
    top1_acc: Number,
    top3_acc: Number,
    top5_acc: Number
  }],
  isActive: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

modelMetadataSchema.statics.getLatest = function() {
  return this.findOne().sort({ trainedAt: -1 });
};

modelMetadataSchema.statics.getActive = function() {
  return this.findOne({ isActive: true });
};

modelMetadataSchema.statics.setActive = function(version) {
  return this.updateMany({}, { isActive: false })
    .then(() => this.updateOne({ version }, { isActive: true }));
};

const ModelMetadata = mongoose.model('ModelMetadata', modelMetadataSchema);

module.exports = ModelMetadata;
