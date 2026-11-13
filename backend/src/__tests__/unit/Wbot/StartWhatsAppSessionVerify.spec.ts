const mockFindByPk = jest.fn();
const mockInitWbot = jest.fn();
const mockRemoveWbot = jest.fn();
const mockEmit = jest.fn();
const mockWbotMessageListener = jest.fn();
const mockWbotMonitor = jest.fn();

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: (...args: unknown[]) => mockFindByPk(...args)
  }
}));

jest.mock("../../../libs/wbot", () => ({
  initWbot: (...args: unknown[]) => mockInitWbot(...args),
  removeWbot: (...args: unknown[]) => mockRemoveWbot(...args)
}));

jest.mock("../../../libs/socket", () => ({
  getIO: () => ({
    emit: (...args: unknown[]) => mockEmit(...args)
  })
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: (...args: unknown[]) => mockWbotMessageListener(...args)
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockWbotMonitor(...args)
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

  it("removes the stale session before restarting after sendSeen failures", async () => {
    const whatsapp = {
      id: 42,
      tenantId: 7,
      update: jest.fn().mockResolvedValue(undefined)
    };
    const wbot = { id: 42 };

    mockFindByPk.mockResolvedValue(whatsapp);
    mockRemoveWbot.mockResolvedValue(undefined);
    mockInitWbot.mockResolvedValue(wbot);

    await StartWhatsAppSessionVerify(
      42,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(mockFindByPk).toHaveBeenCalledWith(42);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockEmit).toHaveBeenCalledWith("7:whatsappSession", {
      action: "update",
      session: whatsapp
    });
    expect(mockRemoveWbot).toHaveBeenCalledWith(42);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitWbot.mock.invocationCallOrder[0]
    );
    expect(mockWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });
});
