"""Copy one pinned production build token through private CLI streams."""
import json, subprocess, sys
from common import Infisical, ROOT, SecretError, cli_environment
PROJECT = "490f971e-8be3-4aec-b1f6-0851ada9661e"
VERCEL_PROJECT = "prj_SnsRSVzZt8kjVFQ33AqbwsHKdZPp"
TEAM = "team_eE2Iv7IMqPOx8ZVN2xNfR2f0"
KEY = "SENTRY_AUTH_TOKEN"

class Production(Infisical):
    def __init__(self):
        super().__init__(ROOT)
        self.project = PROJECT
        if self.domain != "https://app.infisical.com":
            raise SecretError("This production destination is pinned to the US cloud.")
    def command(self, args, value=None):
        command = ["infisical", *args, "--projectId", self.project, "--domain", self.domain,
                   "--env", "prod", "--path", "/", "--silent", "--telemetry=false"]
        result = subprocess.run(command, cwd=ROOT, env=cli_environment(), input=value,
                                capture_output=True, text=True, timeout=120)
        if result.returncode:
            raise SecretError("Production secret fetch failed; details suppressed.")
        return result.stdout

def vercel(method, payload=None):
    path = "/v10/projects/" + VERCEL_PROJECT + "/env?teamId=" + TEAM
    args = ["vercel", "api", path + ("&upsert=true" if method == "POST" else ""),
            "--method", method, "--raw", "--scope", "tsilvas-projects"]
    body = None
    if payload is not None:
        args += ["--input", "-"]
        body = json.dumps(payload)
    result = subprocess.run(args, cwd=ROOT, env=cli_environment(), input=body,
                            capture_output=True, text=True, timeout=90)
    if result.returncode:
        raise SecretError("Vercel request failed; details suppressed.")
    try: return json.loads(result.stdout)
    except Exception:
        raise SecretError("Unexpected Vercel response; details suppressed.") from None

def sync(client=None):
    values = (client or Production()).read()
    value = values.get(KEY)
    if not value or "\0" in value:
        raise SecretError("Required production build token is missing or invalid; no writes.")
    before = vercel("GET")["envs"]
    matches = [item for item in before if item["key"] == KEY and "production" in item.get("target", [])]
    if len(matches) > 1 or any(item["target"] != ["production"] for item in matches):
        raise SecretError("Combined or duplicate destination targets require review; no writes.")
    response = vercel("POST", {"key": KEY, "value": value, "type": "sensitive", "target": ["production"],
                              "comment": "Managed from Infisical llame-production by secrets:sync:production"})
    created = response.get("created")
    if response.get("failed") or not isinstance(created, dict) or created.get("key") != KEY or created.get("target") != ["production"]:
        raise SecretError("Vercel did not confirm the production write; details suppressed.")
    after = vercel("GET")["envs"]
    matched = [item for item in after if item["key"] == KEY and item.get("target") == ["production"]
               and item.get("id") == created.get("id") and item.get("type") == "sensitive"]
    if len(matched) != 1:
        raise SecretError("Production metadata verification failed.")
    print(KEY + ": copied; production metadata verified. Redeploy to verify the token during the build.")

def main(arguments=None):
    arguments = sys.argv[1:] if arguments is None else arguments
    if arguments: raise SecretError("No destination or environment overrides are supported.")
    sync()

if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error) if isinstance(error, SecretError) else "Production sync failed; credential details suppressed.", file=sys.stderr)
        sys.exit(1)
