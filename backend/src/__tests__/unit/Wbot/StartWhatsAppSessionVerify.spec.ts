import { initWbot, removeWbot } from "../../../libs/wbot";
import { getIO } from "../../../libs/socket";
import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn()
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

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

const initWbotMock = initWbot as jest.Mock;
const removeWbotMock = removeWbot as jest.Mock;
const getIOMock = getIO as jest.Mock;
const findByPkMock = Whatsapp.findByPk as jest.Mock;
const wbotMessageListenerMock = wbotMessageListener as jest.Mock;
const wbotMonitorMock = wbotMonitor as jest.Mock;

const flushPromises = (): Promise<void> =>
  new Promise(resolve => setImmediate(resolve));

describe("StartWhatsAppSessionVerify", () => {
  const emit = jest.fn();
  const wbot = { id: 10 };
  let whatsapp: any;

  beforeEach(() => {
    whatsapp = {
      id: 10,
      tenantId: 20,
      update: jest.fn().mockResolvedValue(undefined)
    };

    getIOMock.mockReturnValue({ emit });
    findByPkMock.mockResolvedValue(whatsapp);
    initWbotMock.mockResolvedValue(wbot);
  });

  it("should ignore errors that do not require a session restart", async () => {
    await StartWhatsAppSessionVerify(10, new Error("invalid number"));

    expect(findByPkMock).not.toHaveBeenCalled();
    expect(removeWbotMock).not.toHaveBeenCalled();
    expect(initWbotMock).not.toHaveBeenCalled();
  });

  it("should remove the stale session before initializing a new one", async () => {
    await StartWhatsAppSessionVerify(10, new Error("Session closed"));

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(emit).toHaveBeenCalledWith("20:whatsappSession", {
      action: "update",
      session: whatsapp
    });
    expect(removeWbotMock).toHaveBeenCalledWith(10);
    expect(initWbotMock).toHaveBeenCalledWith(whatsapp);
    expect(wbotMessageListenerMock).toHaveBeenCalledWith(wbot);
    expect(wbotMonitorMock).toHaveBeenCalledWith(wbot, whatsapp);
    expect(
      removeWbotMock.mock.invocationCallOrder[0]
    ).toBeLessThan(initWbotMock.mock.invocationCallOrder[0]);
  });

  it("should not start concurrent restarts for the same whatsapp", async () => {
    let resolveInitWbot: (value: unknown) => void = () => undefined;
    initWbotMock.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveInitWbot = resolve;
        })
    );

    const firstRestart = StartWhatsAppSessionVerify(
      10,
      new Error("Session closed")
    );
    await flushPromises();

    const secondRestart = StartWhatsAppSessionVerify(
      10,
      new Error("ERR_WAPP_NOT_INITIALIZED")
    );
    await flushPromises();

    expect(findByPkMock).toHaveBeenCalledTimes(1);
    expect(removeWbotMock).toHaveBeenCalledTimes(1);
    expect(initWbotMock).toHaveBeenCalledTimes(1);

    resolveInitWbot(wbot);
    await firstRestart;
    await secondRestart;
  });
});
