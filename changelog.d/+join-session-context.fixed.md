Joining a session from mirrord ui injects that session's own header even when it runs in a kube context other than the current one, instead of falling back to `baggage`.
