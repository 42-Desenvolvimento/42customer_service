const mockEmit = jest.fn();
const mockFindByPk = jest.fn();
const mockInitWbot = jest.fn();
const mockRemoveWbot = jest.fn();
const mockWbotMessageListener = jest.fn();
const mockWbotMonitor = jest.fn();

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({ emit: mockEmit }))
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: { findByPk: mockFindByPk }
}));

jest.mock("../../../libs/wbot", () => ({
  initWbot: mockInitWbot,
  removeWbot: mockRemoveWbot
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: mockWbotMessageListener
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: mockWbotMonitor
}));

jest.mock(
  "../../../services/InstagramBotServices/StartInstaBotSession",
  () => ({
    StartInstaBotSession: jest.fn()
  })
);

jest.mock("../../../services/TbotServices/StartTbotSession", () => ({
  StartTbotSession: jest.fn()
}));

jest.mock("../../../services/WABA360/StartWaba360", () => ({
  StartWaba360: jest.fn()
}));

jest.mock(
  "../../../services/MessengerChannelServices/StartMessengerBot",
  () => ({
    StartMessengerBot: jest.fn()
  })
);

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn()
  }
}));

import { initWbot, removeWbot } from "../../../libs/wbot";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

const buildWhatsapp = () => {
  const whatsapp = {
    id: 7,
    tenantId: 3,
    type: "whatsapp",
    status: "CONNECTED",
    update: jest.fn()
  };

  whatsapp.update.mockImplementation(async attrs => {
    Object.assign(whatsapp, attrs);
    return whatsapp;
  });

  return whatsapp;
};

describe("StartWhatsAppSession recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitWbot.mockResolvedValue({ id: 7 });
  });

  it("removes the stale session before recreating it after a sendSeen failure", async () => {
    const whatsapp = buildWhatsapp();
    mockFindByPk.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new Error(
        "TypeError: Cannot read properties of undefined (reading 'sendSeen')"
      )
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);

    const removeOrder = (removeWbot as jest.Mock).mock.invocationCallOrder[0];
    const initOrder = (initWbot as jest.Mock).mock.invocationCallOrder[0];
    expect(removeOrder).toBeLessThan(initOrder);
    expect(mockWbotMessageListener).toHaveBeenCalledWith({ id: 7 });
    expect(mockWbotMonitor).toHaveBeenCalledWith({ id: 7 }, whatsapp);
  });

  it("removes any previous WhatsApp client before manual session start", async () => {
    const whatsapp = buildWhatsapp();

    await StartWhatsAppSession(whatsapp as any);

    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);

    const removeOrder = (removeWbot as jest.Mock).mock.invocationCallOrder[0];
    const initOrder = (initWbot as jest.Mock).mock.invocationCallOrder[0];
    expect(removeOrder).toBeLessThan(initOrder);
  });
});
