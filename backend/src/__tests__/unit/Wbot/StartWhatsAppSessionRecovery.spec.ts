const mockInitWbot = jest.fn();
const mockRemoveWbot = jest.fn();
const mockFindByPk = jest.fn();
const mockEmit = jest.fn();
const mockWbotMessageListener = jest.fn();
const mockWbotMonitor = jest.fn();

jest.mock("../../../libs/wbot", () => ({
  initWbot: mockInitWbot,
  removeWbot: mockRemoveWbot
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: mockFindByPk
  }
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({
    emit: mockEmit
  }))
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: mockWbotMessageListener
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: mockWbotMonitor
}));

jest.mock("../../../services/InstagramBotServices/StartInstaBotSession", () => ({
  StartInstaBotSession: jest.fn()
}));

jest.mock("../../../services/TbotServices/StartTbotSession", () => ({
  StartTbotSession: jest.fn()
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

import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

describe("WhatsApp session recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("removes the stale session before restarting after sendSeen failures", async () => {
    const callOrder: string[] = [];
    const whatsapp = {
      id: 7,
      tenantId: 3,
      update: jest.fn().mockResolvedValue(undefined)
    };
    const wbot = { id: 7 };

    mockFindByPk.mockResolvedValue(whatsapp);
    mockRemoveWbot.mockImplementation(async () => {
      callOrder.push("remove");
    });
    mockInitWbot.mockImplementation(async () => {
      callOrder.push("init");
      return wbot;
    });

    await StartWhatsAppSessionVerify(
      7,
      new TypeError("Cannot read properties of undefined (reading 'sendSeen')")
    );

    expect(mockRemoveWbot).toHaveBeenCalledWith(7);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(callOrder).toEqual(["remove", "init"]);
    expect(mockWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("removes the current WhatsApp client before a manual session start", async () => {
    const callOrder: string[] = [];
    const whatsapp = {
      id: 11,
      tenantId: 3,
      type: "whatsapp",
      update: jest.fn().mockResolvedValue(undefined)
    };
    const wbot = { id: 11 };

    mockRemoveWbot.mockImplementation(async () => {
      callOrder.push("remove");
    });
    mockInitWbot.mockImplementation(async () => {
      callOrder.push("init");
      return wbot;
    });

    await StartWhatsAppSession(whatsapp as any);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockRemoveWbot).toHaveBeenCalledWith(11);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(callOrder).toEqual(["remove", "init"]);
  });
});
