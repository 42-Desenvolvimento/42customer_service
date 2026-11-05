import { getIO } from "../../../libs/socket";
import { initWbot, removeWbot } from "../../../libs/wbot";
import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn()
}));

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: jest.fn()
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

const initWbotMock = initWbot as jest.MockedFunction<typeof initWbot>;
const removeWbotMock = removeWbot as jest.MockedFunction<typeof removeWbot>;
const getIOMock = getIO as jest.MockedFunction<typeof getIO>;
const findByPkMock = Whatsapp.findByPk as jest.Mock;

const flushPromises = (): Promise<void> =>
  new Promise(resolve => setImmediate(resolve));

const buildWhatsapp = () =>
  ({
    id: 42,
    name: "main",
    tenantId: 7,
    type: "whatsapp",
    update: jest.fn().mockResolvedValue(undefined)
  } as unknown as Whatsapp);

describe("WhatsApp session recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getIOMock.mockReturnValue({ emit: jest.fn() } as any);
    initWbotMock.mockResolvedValue({ id: 42 } as any);
    removeWbotMock.mockResolvedValue(undefined);
  });

  it("recovers sendSeen disconnections by replacing the stale session", async () => {
    const whatsapp = buildWhatsapp();
    findByPkMock.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbotMock).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
    expect(wbotMessageListener).toHaveBeenCalledWith({ id: 42 });
    expect(wbotMonitor).toHaveBeenCalledWith({ id: 42 }, whatsapp);
    expect(removeWbotMock.mock.invocationCallOrder[0]).toBeLessThan(
      initWbotMock.mock.invocationCallOrder[0]
    );
  });

  it("waits for the old session removal before initializing a recovered session", async () => {
    const whatsapp = buildWhatsapp();
    let finishRemoval!: () => void;
    findByPkMock.mockResolvedValue(whatsapp);
    removeWbotMock.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          finishRemoval = resolve;
        })
    );

    const recovery = StartWhatsAppSessionVerify(whatsapp.id, "session closed");
    await flushPromises();

    expect(removeWbotMock).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbotMock).not.toHaveBeenCalled();

    finishRemoval();
    await recovery;

    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
  });

  it("waits for the old session removal before starting a requested whatsapp session", async () => {
    const whatsapp = buildWhatsapp();

    await StartWhatsAppSession(whatsapp);

    expect(removeWbotMock).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
    expect(removeWbotMock.mock.invocationCallOrder[0]).toBeLessThan(
      initWbotMock.mock.invocationCallOrder[0]
    );
  });
});
