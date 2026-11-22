const mockInitWbot = jest.fn();
const mockRemoveWbot = jest.fn();
const mockFindByPk = jest.fn();
const mockEmit = jest.fn();
const mockGetIO = jest.fn();
const mockWbotMessageListener = jest.fn();
const mockWbotMonitor = jest.fn();

jest.mock("../../../libs/wbot", () => ({
  initWbot: (...args: unknown[]) => mockInitWbot(...args),
  removeWbot: (...args: unknown[]) => mockRemoveWbot(...args)
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: (...args: unknown[]) => mockFindByPk(...args)
  }
}));

jest.mock("../../../libs/socket", () => ({
  getIO: (...args: unknown[]) => mockGetIO(...args)
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: (...args: unknown[]) => mockWbotMessageListener(...args)
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockWbotMonitor(...args)
}));

jest.mock("../../../services/TbotServices/StartTbotSession", () => ({
  StartTbotSession: jest.fn()
}));

jest.mock("../../../services/InstagramBotServices/StartInstaBotSession", () => ({
  StartInstaBotSession: jest.fn()
}));

jest.mock("../../../services/WABA360/StartWaba360", () => ({
  StartWaba360: jest.fn()
}));

jest.mock("../../../services/MessengerChannelServices/StartMessengerBot", () => ({
  StartMessengerBot: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";

describe("WhatsApp session recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetIO.mockReturnValue({ emit: mockEmit });
    mockInitWbot.mockResolvedValue({ id: 10 });
    mockRemoveWbot.mockResolvedValue(undefined);
  });

  it("recreates the client when sendSeen fails with the current undefined-property error", async () => {
    const callOrder: string[] = [];
    const whatsapp = {
      id: 10,
      tenantId: 20,
      update: jest.fn().mockResolvedValue(undefined)
    };

    mockFindByPk.mockResolvedValue(whatsapp);
    mockRemoveWbot.mockImplementation(async () => {
      callOrder.push("remove");
    });
    mockInitWbot.mockImplementation(async () => {
      callOrder.push("init");
      return { id: 10 };
    });

    await StartWhatsAppSessionVerify(
      10,
      new TypeError("Cannot read properties of undefined (reading 'sendSeen')")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockEmit).toHaveBeenCalledWith("20:whatsappSession", {
      action: "update",
      session: whatsapp
    });
    expect(mockRemoveWbot).toHaveBeenCalledWith(10);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(callOrder).toEqual(["remove", "init"]);
    expect(mockWbotMessageListener).toHaveBeenCalledWith({ id: 10 });
    expect(mockWbotMonitor).toHaveBeenCalledWith({ id: 10 }, whatsapp);
  });

  it("does not restart the client for unrelated send errors", async () => {
    await StartWhatsAppSessionVerify(10, new Error("temporary upload failure"));

    expect(mockFindByPk).not.toHaveBeenCalled();
    expect(mockRemoveWbot).not.toHaveBeenCalled();
    expect(mockInitWbot).not.toHaveBeenCalled();
  });

  it("removes any stale client before starting a whatsapp session", async () => {
    const callOrder: string[] = [];
    const whatsapp = {
      id: 10,
      tenantId: 20,
      type: "whatsapp",
      update: jest.fn().mockResolvedValue(undefined)
    };

    mockRemoveWbot.mockImplementation(async () => {
      callOrder.push("remove");
    });
    mockInitWbot.mockImplementation(async () => {
      callOrder.push("init");
      return { id: 10 };
    });

    await StartWhatsAppSession(whatsapp as any);

    expect(mockRemoveWbot).toHaveBeenCalledWith(10);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(callOrder).toEqual(["remove", "init"]);
  });
});
