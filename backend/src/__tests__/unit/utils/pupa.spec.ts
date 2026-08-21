jest.mock("date-fns", () => ({
  getHours: jest.fn()
}));

import { getHours } from "date-fns";
import { MissingValueError, pupa } from "../../../utils/pupa";

const getHoursMock = getHours as jest.Mock;

describe("pupa", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [6, "Bom dia!"],
    [11, "Bom dia!"],
    [12, "Boa Tarde!"],
    [17, "Boa Tarde!"],
    [18, "Boa Noite!"],
    [23, "Boa Noite!"],
    [0, "Olá!"]
  ])("injects the expected greeting for hour %s", (hour, greeting) => {
    getHoursMock.mockReturnValue(hour);

    expect(pupa("{greeting}, {name}", { name: "Ana" })).toBe(
      `${greeting}, Ana`
    );
  });

  it("escapes double-brace replacements while keeping single-brace values raw", () => {
    getHoursMock.mockReturnValue(9);

    expect(
      pupa("safe={{value}} raw={value}", { value: "<strong>Ana</strong>" })
    ).toBe(
      "safe=&lt;strong&gt;Ana&lt;/strong&gt; raw=<strong>Ana</strong>"
    );
  });

  it("throws when a required placeholder is missing", () => {
    getHoursMock.mockReturnValue(9);

    expect(() =>
      pupa("Olá {name}", {}, { ignoreMissing: false })
    ).toThrow(MissingValueError);
  });
});
