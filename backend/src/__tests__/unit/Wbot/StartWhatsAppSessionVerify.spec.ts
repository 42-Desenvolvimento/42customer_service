const mockFindByPk = jest.fn();
const mockInitWbot = jest.fn();
const mockRemoveWbot = jest.fn();
const mockWbotMessageListener = jest.fn();
const mockWbotMonitor = jest.fn();
const mockEmit = jest.fn();

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: (...args: any[]) => mockFindByPk(...args)
  }
}));

jest.mock("../../../libs/wbot", () => ({
  initWbot: (...args: any[]) => mockInitWbot(...args),
  removeWbot: (...args: any[]) => mockRemoveWbot(...args)
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({
    emit: mockEmit
  }))
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: (...args: any[]) => mockWbotMessageListener(...args)
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: (...args: any[]) => mockWbotMonitor(...args)
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

describe("StartWhatsAppSessionVerify", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("removes the stale session before starting a new one after sendSeen failures", async () => {
    const callOrder: string[] = [];
    const wbot = {};
    const whatsapp = {
      id: 42,
      tenantId: 7,
      update: jest.fn().mockResolvedValue(undefined)
    };

    mockFindByPk.mockResolvedValue(whatsapp);
    mockRemoveWbot.mockImplementation(async () => {
      callOrder.push("remove");
    });
    mockInitWbot.mockImplementation(async () => {
      callOrder.push("init");
      return wbot;
    });

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockEmit).toHaveBeenCalledWith("7:whatsappSession", {
      action: "update",
      session: whatsapp
    });
    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(callOrder).toEqual(["remove", "init"]);
    expect(mockWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });
});
