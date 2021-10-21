//app.js
App({
  onLaunch: function () {
    wx.cloud.init({
      env: 'cloud1-4git8l8o868abd47',
      traceUser: true,
    })

    this.globalData.windowWidth_curr = wx.getSystemInfoSync().windowWidth;
    this.globalData.windowheight_curr = wx.getSystemInfoSync().windowHeight; 
    console.log(this.globalData.windowWidth_curr)
    console.log(this.globalData.windowheight_curr)
  },

  globalData: {
    userInfo: null,
    conct_deviceid:null,
    conct_name:null,
    windowWidth_curr:0,
    windowheight_curr:0,
  }
})