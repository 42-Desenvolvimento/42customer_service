const mockEmit = jest.fn();

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
  getIO: jest.fn(() => ({ emit: mockEmit }))
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  __esModule: true,
  default: jest.fn()
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

import Whatsapp from "../../../models/Whatsapp";
import { initWbot, removeWbot } from "../../../libs/wbot";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

const mockedWhatsapp = Whatsapp as unknown as { findByPk: jest.Mock };
const mockedInitWbot = initWbot as jest.Mock;
const mockedRemoveWbot = removeWbot as jest.Mock;

describe("StartWhatsAppSessionVerify", () => {
  let whatsapp: {
    id: number;
    tenantId: number;
    update: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    whatsapp = {
      id: 42,
      tenantId: 7,
      update: jest.fn().mockResolvedValue(undefined)
    };

    mockedWhatsapp.findByPk.mockResolvedValue(whatsapp);
    mockedRemoveWbot.mockResolvedValue(undefined);
    mockedInitWbot.mockResolvedValue({ id: whatsapp.id });
  });

  it("restarts the session after current sendSeen undefined errors", async () => {
    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read properties of undefined (reading 'sendSeen')")
    );

    expect(mockedWhatsapp.findByPk).toHaveBeenCalledWith(whatsapp.id);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockEmit).toHaveBeenCalledWith("7:whatsappSession", {
      action: "update",
      session: whatsapp
    });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(
      mockedRemoveWbot.mock.invocationCallOrder[0]
    ).toBeLessThan(mockedInitWbot.mock.invocationCallOrder[0]);
  });

  it("does not restart the session for unrelated errors", async () => {
    await StartWhatsAppSessionVerify(whatsapp.id, new Error("rate limited"));

    expect(mockedWhatsapp.findByPk).not.toHaveBeenCalled();
    expect(mockedRemoveWbot).not.toHaveBeenCalled();
    expect(mockedInitWbot).not.toHaveBeenCalled();
  });
});
