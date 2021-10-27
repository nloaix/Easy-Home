//index.js
//获取应用实例
const app = getApp()

function inArray(arr, key, val) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i][key] === val) {
      return i;
    }
  }
  return -1;
}

// ArrayBuffer转16进度字符串示例
function ab2hex(buffer) {
  var hexArr = Array.prototype.map.call(
    new Uint8Array(buffer),
    function (bit) {
      return ('00' + bit.toString(16)).slice(-2)
    }
  )
  return hexArr.join('');
}

Page({
  data: {
    userInfo: {},
    hasUserInfo: false,
    canIUseGetUserProfile: false,
    devices:[],
    scanbit_flag: false,
    envId:'',
    openId:''
  },

  // 弹出窗口 
  showHintModal(msg) {
    wx.showModal({
      title: '提示',
      content: msg,
      showCancel: false,
      confirmText: "我知道了",
      confirmColor: '#3dccca',
    })
  },

  //事件处理函数
  // 以下为蓝牙扫描相关方法/////////////////////////////////////////////////////////////////////////////////////////////////////////////
  start_scan_device() {
    this.setData({
      scanbit_flag: true,
      devices: [],
    })
    wx.showLoading({
      title: '搜索中...',
    })
    console.log('搜索开始')
    //开始蓝牙初始化
    this.openBluetoothAdapter()
    let that = this;
    setTimeout(function () {
      that.setData({
        scanbit_flag: false,
      });
      wx.hideLoading();
      console.log(that.data.devices)
      console.log(that.data.devices.name)
      if(that.data.devices.length == 0){
        console.log("没有找到设备设备")
        that.showHintModal("没有找到设备，请打开设备！")
      } else {
        console.log("搜到设备")
      }
      if (that._discoveryStarted) {
        console.log("stopBluetoothDevicesDiscovery")
        wx.stopBluetoothDevicesDiscovery();
        that._discoveryStarted = false;
      }
    }, 5000); //设置loading关闭时间
    // 判断是否有Storage 必须要这个，如果没有这个，点击搜索图标时无法清除数据
    var hasdevice = wx.getStorageSync('d111')
    if(hasdevice){
      console.log('-------有d111这个缓存数据22222-----')
      this.removeStorage()
    }
  },

 // 初始化蓝牙
  openBluetoothAdapter(){
    wx.openBluetoothAdapter({
      success: (res) => {  
        console.log('openBluetoothAdapter success', res)
        // startBluetoothDevicesDiscovery 开始搜索附近的蓝牙外围设备
        this.startBluetoothDevicesDiscovery()  
      },
      fail: (res) => {
        console.log("蓝牙初始化失败", res.errCode)
        if (res.errCode === 10001) {
          this.showHintModal("请打开手机蓝牙")
          //等待蓝牙适配器到能用状态 开始扫描  onBluetoothAdapterStateChange监听蓝牙适配器状态变化
          wx.onBluetoothAdapterStateChange(function (res) {
            console.log('onBluetoothAdapterStateChange', res)
            if (res.available) {
              this.startBluetoothDevicesDiscovery()
            }
          })
        }
      }
    })
  },

  //获取本机蓝牙适配器的状态
  getBluetoothAdapterState() {
    wx.getBluetoothAdapterState({
      success: (res) => {
        console.log('getBluetoothAdapterState', res)
        if (res.discovering) { //discovering 是否正在搜索设备
          this.onBluetoothDeviceFound() // onBluetoothDeviceFound 监听搜索到新设备的事件
        } else if (res.available) {  // available 蓝牙适配器是否可用
          this.startBluetoothDevicesDiscovery()
        }
      }
    })
  },
  
  //开始搜索蓝牙外围设备 一个开始搜索的动作
  startBluetoothDevicesDiscovery() {
    if (this._discoveryStarted) {
      return
    }
    this._discoveryStarted = true
    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: true,  /* 是否允许重复上报同一设备 */
      success: (res) => {
        console.log('startBluetoothDevicesDiscovery success 监听搜索到新设备的事件', res)
        this.onBluetoothDeviceFound()
      },
    })
  },

  // 监听搜索到新设备的事件
  onBluetoothDeviceFound() {
    wx.onBluetoothDeviceFound((res) => {
      res.devices.forEach(device => {
        if (!device.name && !device.localName) {
          return
        }
        console.log('打印设备的deviceName：'+ device.name)
        if (device.advertisData.byteLength != 10) {
          return 
        }
        const foundDevices = this.data.devices
        const idx = inArray(foundDevices, 'deviceId', device.deviceId)
        const data = {}
        let rediodata = new DataView(device.advertisData)
        // A0-颈部  B0-腰部 C0-成人
        if ((rediodata.getUint8(0) == 0xA0 || rediodata.getUint8(0) == 0xB0 || rediodata.getUint8(0) == 0xC0 ) && (rediodata.getUint8(2) == 0x03 || rediodata.getUint8(2) == 0x01)) {
          if (idx === -1) { // new devicie
            data[`devices[${foundDevices.length}]`] = device
          } else { //old device
            data[`devices[${idx}]`] = device
          }
          this.setData(data)
        }
      })
    })
  },
  // 以上为蓝牙扫描相关方法/////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // 连接点击
  createBLEConnection(e) {
    const arr = new Array(this.data.devices[0])
    const arr1 = new Array(this.data.devices[1])
    const ds = e.currentTarget.dataset
    const deviceId = ds.deviceId
    const name = ds.name
    // 此处的deviceId是点击连接设备的id
    console.log("当前点击连接设备的id==="+deviceId)
    // 此处device_list_id是设备列表中下标位0的设备id
    const device_list_id = this.data.devices[0].deviceId
    if(deviceId == device_list_id){
      wx.setStorage({
        key:'d111',
        data:arr,
        success(){
          console.log('--存储数据arr成功------')
        }
      })
    }else{
      wx.setStorage({
        key:'d111',
        data:arr1
      })
    }
    if (this._discoveryStarted) {
      wx.stopBluetoothDevicesDiscovery()
      this._discoveryStarted = false;
    }
    wx.showLoading({ 
      title: '连接设备中...',
    })
    wx.createBLEConnection({
      deviceId,
      timeout: 4000,
      success: (res) => {
        app.globalData.conct_deviceid = deviceId,
        app.globalData.conct_name = name,
        // conctDeviceId = app.globalData.conct_deviceid,
        // conctName = app.globalData.conct_name,
        console.log("name============="+name)
        wx.hideLoading();
        var regex = /^S.\s+/;
        if(regex.test(name)){
          console.log('name===s8' )
          wx.navigateTo({
            url: '/pages/ble/ble',
          })
        }else{
          console.log('name===w2')
          wx.navigateTo({
            url: '/pages/ble-w2/ble-w2',
          })
        }
      },
      fail: (res) => {
        wx.hideLoading();
        console.log("res.errCode=="+res.errCode)
        if (res.errCode > 0) {
          wx.closeBluetoothAdapter({
            success: (res) => {
              console.log('关闭蓝牙模块成功')
              this.openBluetoothAdapter()  //关闭蓝牙模块之后重新初始化
            },
            fail:(res) => {
              console.log('关闭蓝牙模块失败')
            }
          })
          wx.showToast({
            title: '连接失败.. 请重新点击连接',
            icon: 'none',
            duration: 1000,
          })
        }
      }
    })
  },

  onLoad: function() {
    // 获取用户的openid
    this.setData({
      envId: this.data.envId
    })
    this.getOpenId()
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      })
    }
    var userInfo = wx.getStorageSync('userInfo')
    if(userInfo){
      this.setData({
        hasUserInfo:true,
      })
      this.getUserInfo()
    }else{
      console.log('----没有缓存用户信息----')
    }
    // 界面在下一次加载就获取缓存的信息 判断是否有缓存数据
    var hasdevice = wx.getStorageSync('d111')
    console.log(hasdevice)
    if(hasdevice){
      console.log('-------有d111这个缓存数据-----')
      var hasdevice_name = hasdevice[0].name
      var hasdevice_localName = hasdevice[0].localName
      console.log("hasdevice_name==="+hasdevice_name)
      console.log("hasdevice_localName==="+hasdevice_localName)
      this.setData(hasdevice)
      console.log('-----4455-')
      // 此处的itemname是赋值后的devices列表中下标为0的名字 
      var itemname = 'devices['+ 0 +'].name'
      this.setData({
        devices:hasdevice,
        [itemname]:hasdevice_name+"(已连接过的设备)"
      })
      console.log(this.data.devices)
      console.log("----成功提取----")
      // 初始化蓝牙 如果没有这个初始化蓝牙的话 下次打开后会重新连接不上，查看errCode=10000
      wx.openBluetoothAdapter({
        success:() => {
          // console.log("初始化后的res.errCode=="+res.errCode)
        }
      })
    }else{
      console.log('-------没有d111这个缓存数据------')
    }
  },

  // 获取openid
  getOpenId(){
    wx.cloud.callFunction({
      name:'quickstartFunctions',
      config:{
        env:this.data.envId
      },
      data:{
        type:'getOpenId'
      }
    }).then((resp) => {
      this.setData({
        openId:resp.result.openid
      })
      console.log('成功得到openid'+resp.result.openid)
      this.setOpenId()
    }).catch((e) => {
      console.log('0000')
    })
  },


  // 生命周期函数--监听页面卸载
  onUnload: function () {
    wx.stopBluetoothDevicesDiscovery()
    this._discoveryStarted = false;
    wx.closeBluetoothAdapter({
      success: function (res) {
        console.log("适配器关成功")
      },
      fail: function (res) {}
    })
  },

  // 清除缓存数据
  removeStorage(){
    wx.removeStorage({
      key: 'd111',
      success(){
        console.log('-------清除缓存成功-----------')
      }
    })
  },

  // // 获取用户信息
  getUserProfile(e) {
    wx.getUserProfile({
      desc: '用于完善会员资料', 
      success: (res) => {
        console.log(res)
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
        this.setUserInfo()
      }
    })
  },

 // 存储用户信息到本地
  setUserInfo(){
    wx.setStorage({
      key:'userInfo',
      data:this.data.userInfo,
      success(){
        console.log('----用户信息缓存成功----')
      }
    })
  },

 // 存储OPENID到本地
  setOpenId(){
    wx.setStorage({
      key:'openId',
      data:this.data.openId,
      success(){
        console.log('----openid缓存成功----')
      }
    })
  },

  // 获取缓存在本地的用户信息
  getUserInfo(){
    wx.getStorage({
      key:'userInfo',
      success:(res)=>{
        this.setData({
          userInfo:res.data
        })
      }
    })
  },

  // 此处增加跳转到产品开机与蓝牙检查提醒
  unfind_ble: function () {
    wx.navigateTo({
      url: '/pages/unfind/bleunfind',
    })
  }
})
