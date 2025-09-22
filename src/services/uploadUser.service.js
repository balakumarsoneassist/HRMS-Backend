const UploadUser = require("../models/uploadUser");

class UploadUserService {
  async saveOrUpdate(userId, payload) {
    return UploadUser.findOneAndUpdate(
      { user: userId },
      { $set: payload },
      { new: true, upsert: true }
    );
  }

  async getByUser(userId) {
    return UploadUser.findOne({ user: userId });
  }
}

module.exports = new UploadUserService();
