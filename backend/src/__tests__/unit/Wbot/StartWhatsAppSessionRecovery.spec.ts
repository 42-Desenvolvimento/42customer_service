import Whatsapp from "../../../models/Whatsapp";
import { initWbot, removeWbot } from "../../../libs/wbot";
import { getIO } from "../../../libs/socket";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: jest.fn()
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
    info: jest.fn(),
    warn: jest.fn()
  }
}));

describe("WhatsApp session recovery", () => {
  const initWbotMock = initWbot as jest.MockedFunction<typeof initWbot>;
  const removeWbotMock = removeWbot as jest.MockedFunction<typeof removeWbot>;
  const findByPkMock = Whatsapp.findByPk as jest.Mock;
  const getIOMock = getIO as jest.Mock;
  const wbotMessageListenerMock = wbotMessageListener as jest.Mock;
  const wbotMonitorMock = wbotMonitor as jest.Mock;

  const buildWhatsapp = () =>
    ({
      id: 12,
      tenantId: 34,
      type: "whatsapp",
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    initWbotMock.mockResolvedValue({ id: 12 } as any);
    getIOMock.mockReturnValue({ emit: jest.fn() });
  });

  it("removes the stale client before recovering an uninitialized session", async () => {
    const whatsapp = buildWhatsapp();
    findByPkMock.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new Error("ERR_WAPP_NOT_INITIALIZED")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbotMock).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
    expect(removeWbotMock.mock.invocationCallOrder[0]).toBeLessThan(
      initWbotMock.mock.invocationCallOrder[0]
    );
    expect(wbotMessageListenerMock).toHaveBeenCalledWith({ id: 12 });
    expect(wbotMonitorMock).toHaveBeenCalledWith({ id: 12 }, whatsapp);
  });

  it("recognizes sendSeen disconnection errors when deciding to recover", async () => {
    const whatsapp = buildWhatsapp();
    findByPkMock.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read properties of undefined (reading 'sendSeen')")
    );

    expect(removeWbotMock).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
  });

  it("removes the stale client before starting a whatsapp session", async () => {
    const whatsapp = buildWhatsapp();

    await StartWhatsAppSession(whatsapp);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbotMock).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
    expect(removeWbotMock.mock.invocationCallOrder[0]).toBeLessThan(
      initWbotMock.mock.invocationCallOrder[0]
    );
  });
});
