// pages/ble/ble.js
const app = getApp()


function inArrayble(arr, key, val) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i][key] === val) {
      return i;
    }
  }
  return -1;
}

// ArrayBuffer转16进制字符串示例
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
  /**
   * 页面的初始数据
   */
  data: {
    // 蓝牙与通信相关
    devices: [],
    chs: [],
    ble_data_recver: [], //蓝牙数据
    devicename: 0,
    min:0,
    max:8,
    value:0,

    //产品功能相关
    bat_index: 0, //电池电量
    qiandu_index: 0, //按摩强度
    mode_slect: 0, // 模式选择
    protect_time: 0, // 保护时间


    // 定时相关
    time_interv_index: 0,
  },

  
  closeBLEConnection() {
    wx.closeBLEConnection({
      deviceId: this.data.deviceId
    })
    this.setData({
      scanbit_flag: false,
      chs: [],
      canWrite: false,
    })
  },

  // 连接成功后获取相关的服务
  getBLEDeviceServices(deviceId) {
    wx.onBLEConnectionStateChange(function (res) { // 该方法回调中可以用于处理连接意外断开等异常情况  
      console.log("onBLEConnectionStateChange:", res);
      if (res.connected == false) {
        console.log("连接意外断开等**退出BLE**");
        wx.closeBLEConnection({
          deviceId: app.globalData.conct_deviceid,
          success(res) {
            console.log(res)
          }
        })
        wx.navigateBack({
          delta: 0,
        })
        return
      }
    });

    wx.getBLEDeviceServices({
      deviceId,
      success: (res) => {
        for (let i = 0; i < res.services.length; i++) {
          if (res.services[i].isPrimary) {
            this.getBLEDeviceCharacteristics(deviceId, res.services[i].uuid)
            return
          }
        }
      }
    })
  },

  getBLEDeviceCharacteristics(deviceId, serviceId) {
    wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId,
      success: (res) => {
        console.log('getBLEDeviceCharacteristics success', res.characteristics)
        for (let i = 0; i < res.characteristics.length; i++) {
          let item = res.characteristics[i]
          if (item.properties.read) {
            wx.readBLECharacteristicValue({
              deviceId,
              serviceId,
              characteristicId: item.uuid,
            })
          }
          if (item.properties.write) {
            this.setData({
              canWrite: true
            })
            this._deviceId = deviceId
            this._serviceId = serviceId
            this._characteristicId = item.uuid
            this.send_cmd_data(0xB0, 0x00);
          }
          if (item.properties.notify || item.properties.indicate) {
            wx.notifyBLECharacteristicValueChange({ //启用低功耗蓝牙设备特征值变化时的 notify 功能，订阅特征值。
              deviceId,
              serviceId,
              characteristicId: item.uuid,
              state: true,
              success(res) {
                console.log('notifyBLECharacteristicValueChange success', res.errMsg)
              }
            })
          }
        }
      },
      fail(res) {
        console.error('getBLEDeviceCharacteristics', res)
      }
    })

    // 操作之前先监听，保证第一时间获取数据  开启 监听回调
    wx.onBLECharacteristicValueChange((characteristic) => {
      let dataView = new DataView(characteristic.value)
      for (let ii = 0; ii < characteristic.value.byteLength; ii++) {
        this.data.ble_data_recver.push(dataView.getUint8(ii))
      }
      this.recever_data_refrsh_display();
    })
  },

  recever_data_refrsh_display() {
    let all_length = this.data.ble_data_recver.length
    while (all_length > 19) {
      let data = this.data.ble_data_recver
      var buff_temp = new Array
      let ii = 0
      for (ii = 0; ii < data.length - 19; ii++) {
        if (data[ii] === 0xFE && data[ii + 1] === 0xB0)
          break;
      }
      if (data.length - ii < 20) return
      buff_temp = data.slice(ii, ii + 20)
      this.data.ble_data_recver.splice(0, ii + 20)
      all_length -= ii + 20  // all_length = all_length - (ii + 20)
      let data_sum = 0x00;
      for (ii = 0x00; ii < 19; ii++) {
        data_sum = (data_sum + buff_temp[ii]) & 0xff
      }
      if (data_sum == buff_temp[19]) {
        if (buff_temp[4] === 0x00) {
          console.log("产品关机**退出BLE**"+buff_temp[4]);
          wx.closeBLEConnection({
            deviceId: app.globalData.conct_deviceid,
            success(res) {
              console.log(res)
            }
          })
        }
        if(buff_temp[4] == 0) {   // 表示为关机状态，因为后面数据库的原因所以在关机后不渲染其数据
          console.log('此时已关机，不需要setData数据')
          console.log(this.data.buff_temp)
        }else{
          this.setData({
            buff_temp:buff_temp
          })
        }
        this.setData({
          buff_temp:buff_temp
        })
        if (!this.data.protect_time) { //1为true 0为fasle、
          this.setData({
            bat_index: buff_temp[8],
            mode_slect: buff_temp[5],
          })
          if (buff_temp[5] > 30) {
            this.setData({
              qiandu_index :buff_temp[5] - 32
            })
          } else {
            this.setData({
              qiandu_index : 0,
            })
          }
          console.log("当前的电量的index是："+this.data.bat_index)
        }
        this.setData({
          timeleft: buff_temp[10] * 256 + buff_temp[11],
        })
        console.log(buff_temp)
        console.log("1包数据")
      }
    }
    return function(){
      return buff_temp;
    } 
  },
  

  // 监听蓝牙适配器状态
  getBluetoothState(){
    wx.getBluetoothAdapterState({
      success: (res) => {
        if(res.available){
          console.log('蓝牙适配器可用')
        } else {
          console.log(res.errCord)
          console.log('蓝牙适配器不可用')
        }
      },
    })
  },

  //关闭蓝牙模块
  closeBluetoothAdapter() {
    wx.closeBluetoothAdapter()
    this._discoveryStarted = false
  },


  // 生命周期函数--监听页面加载
  onLoad: function (options) {
    // common.myContent(); //需要执行才能生效哈
    const deviceId = app.globalData.conct_deviceid
    this.getBLEDeviceServices(deviceId) // 获取连接device信息
    wx.setNavigationBarTitle({
      title: 'LQ-S300',
    })
    wx.setNavigationBarColor({
      backgroundColor: '#fff3f3',
      frontColor: '#000000',
    })
  },
  
  // 生命周期函数--监听页面卸载
  onUnload: function () {
    console.log("推出BLE页面")
    wx.closeBLEConnection({
      deviceId: app.globalData.conct_deviceid,
      success(res) {
        console.log(res)
      }
    })
  },

  //生命周期函数--监听页面显示
  onShow: function () {
    // 获取devicename
    const deviceName = app.globalData.conct_name
    this.getBLEDeviceServices(deviceName)
  },


  send_cmd_data(cmd, data) {
    let buff_u8 = new Array
    let ii = 0x00;
    let sum = 0x00;
    buff_u8[ii++] = 0xFE;
    buff_u8[ii++] = cmd;
    buff_u8[ii++] = 0x01;
    buff_u8[ii++] = data;
    for (let jj = 0x00; jj < ii; jj++) {
      sum += buff_u8[jj]
    }
    buff_u8[ii] = sum % 256;
    // 向蓝牙设备发送一个0x00的16进制数据 
    let buffer = new ArrayBuffer(buff_u8.length)
    let dataView = new DataView(buffer)
    for (ii = 0; ii < buff_u8.length; ii++) {
      dataView.setUint8(ii, buff_u8[ii])
    }
    wx.writeBLECharacteristicValue({
      deviceId: this._deviceId,
      serviceId: this._serviceId,
      characteristicId: this._characteristicId,
      value: buffer,
      fail(res){      
          console.log(res)        
      }
    })
    console.log("send_cmd_data下发数据成功")
  },

  // 保护时间 只手机下发数据之后的200ms内接受的数据包都给丢掉 
  // 因为下发数据之后的值界面直接改变，但是在下发同时还会有上方数据包，如果接受这个上发数据包的话，界面的值就会改变，所以才需要这个保护事件
  set_protect_time(e) {
    const that = this
    this.setData({
      protect_time: 1,
    })
    setTimeout(function () {
      that.setData({
        protect_time: 0,
      })
      console.log("一次保护")
    }, 600);
  },

  // 关机操作
  ble_power_off(e) {
    let that = this
    wx.showModal({
      title:'提示',
      content:'确认是否退出？',
      success (res) {
        if (res.confirm){
          console.log('用户点击确定，确认退出')
          that.send_cmd_data(0x10, 0x00);
          wx.navigateBack({
            delta: 0,
          })
        }
      }
    })
  },


  // 拖动过程中触发的事件
  sliderchanging(e) {
    value = e.detail.value
    this.setData({
      value : value
    })
    if (value == 0 ) {
      console.log("value==0" + value)
      this.setData ({
        value : 1,
      })
      this.set_protect_time()
      this.send_cmd_data(0x11,0x21); // value == 0 时会自动调到1
    } else {
      console.log("value!==0" + value)
      this.set_protect_time()
      this.send_cmd_data(0x11,value+32); // 发送指令到底层
    }
  },

  // 模式选择
  mode_slect_heartbeat(e) {
    this.setData({
      mode_slect: 17,
    })
    this.set_protect_time()
    this.send_cmd_data(0x11, this.data.mode_slect);
  },

  mode_slect_gettingbetter(e) {
    this.setData({
      mode_slect: 18,
    })
    this.set_protect_time()
    this.send_cmd_data(0x11, this.data.mode_slect);
  },

  mode_slect_passion(e) {
    this.setData({
      mode_slect: 19,
    })
    this.set_protect_time()
    this.send_cmd_data(0x11, this.data.mode_slect);
  },

  mode_slect_water(e) {
    this.setData({
      mode_slect: 20,
    })
    this.set_protect_time()
    this.send_cmd_data(0x11, this.data.mode_slect);
  }
})