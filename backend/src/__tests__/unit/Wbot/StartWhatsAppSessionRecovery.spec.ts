const mockEmit = jest.fn();
const mockFindByPk = jest.fn();
const mockInitWbot = jest.fn();
const mockRemoveWbot = jest.fn();
const mockWbotMessageListener = jest.fn();
const mockWbotMonitor = jest.fn();

jest.mock("../../../libs/socket", () => ({
  getIO: () => ({ emit: mockEmit })
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: mockFindByPk
  }
}));

jest.mock("../../../libs/wbot", () => ({
  initWbot: (...args: unknown[]) => mockInitWbot(...args),
  removeWbot: (...args: unknown[]) => mockRemoveWbot(...args)
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: (...args: unknown[]) => mockWbotMessageListener(...args)
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockWbotMonitor(...args)
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

import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";

const buildWhatsapp = () => ({
  id: 42,
  tenantId: 7,
  type: "whatsapp",
  update: jest.fn().mockResolvedValue(undefined)
});

describe("WhatsApp session recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitWbot.mockResolvedValue({ id: 42 });
  });

  it("removes a stale session before recovering from sendSeen failures", async () => {
    const whatsapp = buildWhatsapp();
    const calls: string[] = [];

    mockFindByPk.mockResolvedValue(whatsapp);
    mockRemoveWbot.mockImplementation(() => calls.push("remove"));
    mockInitWbot.mockImplementation(async () => {
      calls.push("init");
      return { id: 42 };
    });

    await StartWhatsAppSessionVerify(
      42,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(mockFindByPk).toHaveBeenCalledWith(42);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockRemoveWbot).toHaveBeenCalledWith(42);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(calls).toEqual(["remove", "init"]);
    expect(mockWbotMessageListener).toHaveBeenCalledWith({ id: 42 });
    expect(mockWbotMonitor).toHaveBeenCalledWith({ id: 42 }, whatsapp);
  });

  it("ignores errors that do not indicate a broken WhatsApp session", async () => {
    await StartWhatsAppSessionVerify(42, new Error("rate limited"));

    expect(mockFindByPk).not.toHaveBeenCalled();
    expect(mockRemoveWbot).not.toHaveBeenCalled();
    expect(mockInitWbot).not.toHaveBeenCalled();
  });

  it("removes an existing WhatsApp client before starting a new one manually", async () => {
    const whatsapp = buildWhatsapp();
    const calls: string[] = [];

    mockRemoveWbot.mockImplementation(() => calls.push("remove"));
    mockInitWbot.mockImplementation(async () => {
      calls.push("init");
      return { id: 42 };
    });

    await StartWhatsAppSession(whatsapp as any);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockRemoveWbot).toHaveBeenCalledWith(42);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(calls).toEqual(["remove", "init"]);
    expect(mockWbotMessageListener).toHaveBeenCalledWith({ id: 42 });
    expect(mockWbotMonitor).toHaveBeenCalledWith({ id: 42 }, whatsapp);
  });
});
