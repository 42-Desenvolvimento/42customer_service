describe("StartWhatsAppSession recovery", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("recovers sendSeen failures by removing the stale client before starting a new one", async () => {
    const calls: string[] = [];
    const wbot = { id: 7 };
    const whatsapp: any = {
      id: 7,
      tenantId: 3,
      update: jest.fn(async data => {
        Object.assign(whatsapp, data);
        return whatsapp;
      })
    };
    const removeWbot = jest.fn(async () => {
      calls.push("remove");
    });
    const initWbot = jest.fn(async () => {
      calls.push("init");
      return wbot;
    });
    const wbotMessageListener = jest.fn();
    const wbotMonitor = jest.fn();

    jest.doMock("../../../libs/wbot", () => ({
      initWbot,
      removeWbot
    }));
    jest.doMock("../../../models/Whatsapp", () => ({
      __esModule: true,
      default: {
        findByPk: jest.fn(async () => whatsapp)
      }
    }));
    jest.doMock("../../../libs/socket", () => ({
      getIO: jest.fn(() => ({
        emit: jest.fn()
      }))
    }));
    jest.doMock("../../../services/WbotServices/wbotMessageListener", () => ({
      wbotMessageListener
    }));
    jest.doMock("../../../services/WbotServices/wbotMonitor", () => ({
      __esModule: true,
      default: wbotMonitor
    }));

    const {
      StartWhatsAppSessionVerify
    } = require("../../../services/WbotServices/StartWhatsAppSessionVerify");

    await StartWhatsAppSessionVerify(
      7,
      new TypeError("Cannot read properties of undefined (reading 'sendSeen')")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbot).toHaveBeenCalledWith(7);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(calls).toEqual(["remove", "init"]);
    expect(wbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(wbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("removes a stale client before manually starting a whatsapp session", async () => {
    const calls: string[] = [];
    const wbot = { id: 9 };
    const whatsapp: any = {
      id: 9,
      tenantId: 3,
      type: "whatsapp",
      update: jest.fn(async data => {
        Object.assign(whatsapp, data);
        return whatsapp;
      })
    };
    const removeWbot = jest.fn(async () => {
      calls.push("remove");
    });
    const initWbot = jest.fn(async () => {
      calls.push("init");
      return wbot;
    });
    const wbotMessageListener = jest.fn();
    const wbotMonitor = jest.fn();

    jest.doMock("../../../libs/wbot", () => ({
      initWbot,
      removeWbot
    }));
    jest.doMock("../../../libs/socket", () => ({
      getIO: jest.fn(() => ({
        emit: jest.fn()
      }))
    }));
    jest.doMock("../../../services/WbotServices/wbotMessageListener", () => ({
      wbotMessageListener
    }));
    jest.doMock("../../../services/WbotServices/wbotMonitor", () => ({
      __esModule: true,
      default: wbotMonitor
    }));
    jest.doMock("../../../services/TbotServices/StartTbotSession", () => ({
      StartTbotSession: jest.fn()
    }));
    jest.doMock(
      "../../../services/InstagramBotServices/StartInstaBotSession",
      () => ({
        StartInstaBotSession: jest.fn()
      })
    );
    jest.doMock("../../../services/WABA360/StartWaba360", () => ({
      StartWaba360: jest.fn()
    }));
    jest.doMock(
      "../../../services/MessengerChannelServices/StartMessengerBot",
      () => ({
        StartMessengerBot: jest.fn()
      })
    );

    const {
      StartWhatsAppSession
    } = require("../../../services/WbotServices/StartWhatsAppSession");

    await StartWhatsAppSession(whatsapp);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbot).toHaveBeenCalledWith(9);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(calls).toEqual(["remove", "init"]);
    expect(wbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(wbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });
});
