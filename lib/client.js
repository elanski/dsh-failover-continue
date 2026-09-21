window.__ModuleLoader__.load({
	id: "dsh-failover-continue",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dsh-css:D:\AI\rovodev\dsh-failover-continue\src\client\FailoverContinueCard.module.css.mjs
		const css = ".Qng-sa_card{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:10px;font-size:13px;line-height:1.5}.Qng-sa_head{width:100%;color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:none;align-items:center;gap:10px;padding:12px 14px;display:flex}.Qng-sa_headText{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.Qng-sa_name{font-weight:600}.Qng-sa_description{color:var(--dsw-alias-label-tertiary);font-size:12px}.Qng-sa_pending{color:var(--dsw-alias-label-tertiary);border:.5px solid var(--dsw-alias-border-l4);border-radius:6px;padding:1px 6px;font-size:11px}.Qng-sa_body{border-top:.5px solid var(--dsw-alias-border-l2);flex-direction:column;gap:4px;padding:4px 14px 12px;display:flex}.Qng-sa_readOnly{color:var(--dsw-alias-label-tertiary);margin:8px 0 0}.Qng-sa_row{border-top:.5px solid var(--dsw-alias-border-l2);flex-wrap:wrap;align-items:center;gap:8px;padding:10px 0;display:flex}.Qng-sa_row:first-child{border-top:none}.Qng-sa_row label{flex:1;min-width:160px}.Qng-sa_label{font-weight:500}.Qng-sa_hint{color:var(--dsw-alias-label-tertiary);flex-basis:100%;margin:2px 0 0;font-size:12px}.Qng-sa_badge{color:var(--dsw-alias-label-tertiary);border:.5px solid var(--dsw-alias-border-l4);border-radius:6px;padding:0 5px;font-size:11px}.Qng-sa_reset{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;padding:0;font-size:12px}.Qng-sa_reset:hover{color:var(--dsw-alias-label-primary)}.Qng-sa_input{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);height:30px;font:inherit;border-radius:8px;min-width:0;padding:0 10px}.Qng-sa_input:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.Qng-sa_input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.Qng-sa_inputWide{flex:1}.Qng-sa_inputMono{font-family:var(--dsw-font-mono,ui-monospace, monospace);font-size:12px}.Qng-sa_invalid{border-color:var(--dsw-alias-label-error)}.Qng-sa_invalidText{color:var(--dsw-alias-label-error);flex-basis:100%;margin:0 0 4px;font-size:12px}.Qng-sa_grid{grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px 14px;width:100%;display:grid}.Qng-sa_gridItem{flex-direction:column;gap:4px;display:flex}.Qng-sa_gridItem .Qng-sa_input{box-sizing:border-box;width:100%}.Qng-sa_route{grid-template-columns:minmax(120px,1fr) minmax(140px,2fr) auto;align-items:center;gap:6px;width:100%;display:grid}.Qng-sa_actions{gap:4px;display:flex}.Qng-sa_button{font:inherit;border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:8px;padding:4px 10px;font-size:12px}.Qng-sa_button:hover:not(:disabled){border-color:var(--dsw-alias-border-l2)}.Qng-sa_button:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.Qng-sa_primary{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-inverted,#fff)}.Qng-sa_primary:hover:not(:disabled){filter:brightness(1.05)}.Qng-sa_empty{color:var(--dsw-alias-label-tertiary);margin:4px 0}.Qng-sa_footNote{color:var(--dsw-alias-label-tertiary);margin:2px 0 0;font-size:12px}.Qng-sa_footer{border-top:.5px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:10px;padding-top:10px;display:flex}.Qng-sa_statusOk{color:var(--dsw-alias-label-secondary);margin-right:auto;font-size:12px}.Qng-sa_statusErr{color:var(--dsw-alias-label-error);margin-right:auto;font-size:12px}";
		const tag = "dsh-failover-continue/FailoverContinueCard.module.css";
		if (typeof document !== "undefined" && !document.querySelector("style[data-plugin-css='" + tag + "']")) {
			const node = document.createElement("style");
			node.dataset.plugin = "dsh-failover-continue";
			node.dataset.pluginCss = tag;
			node.textContent = css;
			document.head.appendChild(node);
		}
		var FailoverContinueCard_module_css_default = {
			"body": "Qng-sa_body",
			"hint": "Qng-sa_hint",
			"inputWide": "Qng-sa_inputWide",
			"name": "Qng-sa_name",
			"button": "Qng-sa_button",
			"footer": "Qng-sa_footer",
			"invalid": "Qng-sa_invalid",
			"row": "Qng-sa_row",
			"input": "Qng-sa_input",
			"invalidText": "Qng-sa_invalidText",
			"footNote": "Qng-sa_footNote",
			"grid": "Qng-sa_grid",
			"actions": "Qng-sa_actions",
			"description": "Qng-sa_description",
			"gridItem": "Qng-sa_gridItem",
			"inputMono": "Qng-sa_inputMono",
			"card": "Qng-sa_card",
			"label": "Qng-sa_label",
			"reset": "Qng-sa_reset",
			"headText": "Qng-sa_headText",
			"primary": "Qng-sa_primary",
			"statusErr": "Qng-sa_statusErr",
			"pending": "Qng-sa_pending",
			"statusOk": "Qng-sa_statusOk",
			"badge": "Qng-sa_badge",
			"readOnly": "Qng-sa_readOnly",
			"empty": "Qng-sa_empty",
			"head": "Qng-sa_head",
			"route": "Qng-sa_route"
		};
		//#endregion
		//#region src/client/FailoverContinueCard.tsx
		/**
		* The `failover-continue` plugin card: an expandable card in Settings → Plugins →
		* Plugin configuration, keyed by the settings namespace the host plugin
		* `dsh-failover-continue` registers. Hand-rolled controls (plain
		* elements + one CSS module), staged drafts, and one atomic revision-fenced
		* save through the browser settings scope, mirroring the built-in card pattern.
		*
		* Ported from `dsh-model-failover-settings` (MIT) and extended with the
		* auto-continue section (ported from `dsh-client-auto-continue`, MIT).
		*/
		/** Numeric fields of the breaker half, edited as staged text. */
		const BREAKER_NUMBERS = [
			"modelCircuitThreshold",
			"modelCooldownMs",
			"platformCircuitThreshold",
			"platformCooldownMs",
			"burstWindowMs",
			"maxSwitchesPerStep"
		];
		/** Numeric fields of the auto-continue half, edited as staged text. */
		const CONTINUE_NUMBERS = [
			"graceMs",
			"cooldownMs",
			"maxConsecutive",
			"scanLimit",
			"freshMs",
			"backoffFactor",
			"backoffMaxMs",
			"loopShortChars",
			"loopWindowMs",
			"loopShortCount",
			"loopRepeatText",
			"loopToolRepeat"
		];
		/** All numeric fields. */
		const NUMBER_FIELDS = [...BREAKER_NUMBERS, ...CONTINUE_NUMBERS];
		/** Boolean fields. */
		const TOGGLE_FIELDS = [
			"enabled",
			"scanOnBoot",
			"classify",
			"notify",
			"paused",
			"loopGuard"
		];
		function sameJson(left, right) {
			return JSON.stringify(left) === JSON.stringify(right);
		}
		/**
		* The staged-form controller: holds drafts, merges them over the live scope
		* snapshots into a projection, and writes everything as one revision-fenced
		* mutation on save.
		*/
		var FailoverContinueCardModel = class {
			scope;
			catalog;
			primary;
			listeners = /* @__PURE__ */ new Set();
			snapshot;
			draft = {};
			clears = /* @__PURE__ */ new Set();
			draftRevision;
			saving = false;
			failed = false;
			saved = false;
			constructor(scope, catalog, primary) {
				this.scope = scope;
				this.catalog = catalog;
				this.primary = primary;
				for (const source of [
					scope,
					catalog,
					primary
				]) source.subscribe(() => this.publish());
				this.snapshot = this.project();
			}
			/** The HostObservable face the slot runtime turns into `useCard`. */
			store = {
				getSnapshot: () => this.snapshot,
				subscribe: (listener) => {
					this.listeners.add(listener);
					return () => this.listeners.delete(listener);
				}
			};
			publish() {
				this.snapshot = this.project();
				for (const listener of this.listeners) listener();
			}
			current(field) {
				return this.scope.getSnapshot().value?.[field];
			}
			baseOf(field) {
				return this.scope.getSnapshot().base?.[field];
			}
			overridden(field) {
				const user = this.scope.getSnapshot().user;
				if (user === null || typeof user !== "object") return false;
				return Object.hasOwn(user, field);
			}
			/** Draft value when staged (and not cleared), else the live value. */
			shown(field) {
				if (this.clears.has(field)) return this.baseOf(field) ?? this.current(field);
				return field in this.draft ? this.draft[field] : this.current(field);
			}
			numberText(field) {
				const value = this.shown(field);
				return typeof value === "number" ? String(value) : "";
			}
			parseNumber(text) {
				const trimmed = text.trim();
				if (trimmed === "") return void 0;
				const parsed = Number(trimmed);
				return Number.isFinite(parsed) ? parsed : void 0;
			}
			fallbackRows() {
				const value = this.shown("fallbacks");
				return Array.isArray(value) ? value : [];
			}
			tripCodesText() {
				const value = this.shown("tripCodes");
				return Array.isArray(value) ? value.join(", ") : "";
			}
			textValue(field) {
				const value = this.shown(field);
				return typeof value === "string" ? value : "";
			}
			project() {
				const snap = this.scope.getSnapshot();
				const toggles = {};
				for (const field of TOGGLE_FIELDS) toggles[field] = {
					value: this.shown(field) === true,
					overridden: this.overridden(field)
				};
				const numbers = {};
				let invalid = false;
				for (const field of NUMBER_FIELDS) {
					const text = this.numberText(field);
					const bad = !this.clears.has(field) && field in this.draft && text.trim() !== "" && this.parseNumber(text) === void 0;
					if (bad) invalid = true;
					numbers[field] = {
						text,
						overridden: this.overridden(field),
						invalid: bad
					};
				}
				const rows = this.fallbackRows();
				if (!this.clears.has("fallbacks") && "fallbacks" in this.draft && rows.some((row) => row.provider.trim() === "" || row.model.trim() === "")) invalid = true;
				const catalogValue = this.catalog.getSnapshot().value;
				const providers = Object.keys(catalogValue?.providers ?? {});
				const modelsOf = {};
				for (const provider of providers) modelsOf[provider] = (catalogValue?.providers?.[provider]?.models ?? []).map((model) => model.id).filter((id) => typeof id === "string");
				const primaryValue = this.primary.getSnapshot().value;
				const dirty = this.clears.size > 0 || Object.keys(this.draft).length > 0;
				return {
					available: snap.status === "ready",
					writable: snap.writable,
					dirty,
					invalid,
					saving: this.saving,
					failed: this.failed,
					saved: this.saved,
					toggles,
					numbers,
					fallbacks: rows,
					fallbacksOverridden: this.overridden("fallbacks"),
					tripCodes: this.tripCodesText(),
					tripCodesOverridden: this.overridden("tripCodes"),
					continueText: this.textValue("continueText"),
					continueTextOverridden: this.overridden("continueText"),
					retryableErrorPatterns: this.textValue("retryableErrorPatterns"),
					retryableErrorPatternsOverridden: this.overridden("retryableErrorPatterns"),
					providers,
					modelsOf,
					primary: primaryValue?.provider !== void 0 ? `${primaryValue.provider} / ${primaryValue.model ?? "?"}` : "—",
					baseFallbacksCount: Array.isArray(this.baseOf("fallbacks")) ? this.baseOf("fallbacks").length : 0
				};
			}
			/** Snapshot revision the draft started from (fence for the atomic save). */
			touch() {
				if (this.draftRevision === void 0) this.draftRevision = this.scope.getSnapshot().revision;
				this.saved = false;
				this.failed = false;
			}
			toggle(field, value) {
				this.touch();
				this.clears.delete(field);
				this.draft[field] = value;
				this.publish();
			}
			editNumber(field, text) {
				this.touch();
				const parsed = this.parseNumber(text);
				this.clears.delete(field);
				if (text.trim() === "") this.draft[field] = void 0;
				else this.draft[field] = parsed ?? text;
				this.publish();
			}
			editText(field, text) {
				this.touch();
				this.clears.delete(field);
				this.draft[field] = text;
				this.publish();
			}
			editFallback(index, patch) {
				this.touch();
				const rows = [...this.fallbackRows()];
				const row = rows[index];
				if (row === void 0) return;
				rows[index] = {
					...row,
					...patch
				};
				this.clears.delete("fallbacks");
				this.draft.fallbacks = rows;
				this.publish();
			}
			addFallback() {
				this.touch();
				this.clears.delete("fallbacks");
				this.draft.fallbacks = [...this.fallbackRows(), {
					provider: "",
					model: ""
				}];
				this.publish();
			}
			removeFallback(index) {
				this.touch();
				this.clears.delete("fallbacks");
				this.draft.fallbacks = this.fallbackRows().filter((_row, rowIdx) => rowIdx !== index);
				this.publish();
			}
			moveFallback(index, delta) {
				const rows = [...this.fallbackRows()];
				const target = index + delta;
				if (target < 0 || target >= rows.length) return;
				this.touch();
				const moved = rows.splice(index, 1)[0];
				if (moved === void 0) return;
				rows.splice(target, 0, moved);
				this.clears.delete("fallbacks");
				this.draft.fallbacks = rows;
				this.publish();
			}
			editTripCodes(text) {
				this.touch();
				this.clears.delete("tripCodes");
				this.draft.tripCodes = text.split(",").map((code) => code.trim()).filter((code) => code.length > 0);
				this.publish();
			}
			/** Stage a clear: saving drops the user override, the field re-inherits. */
			resetField(field) {
				this.touch();
				delete this.draft[field];
				this.clears.add(field);
				this.publish();
			}
			discard() {
				this.draft = {};
				this.clears.clear();
				this.draftRevision = void 0;
				this.failed = false;
				this.saved = false;
				this.publish();
			}
			/** Build the full write plan from the drafts vs the live resolved value. */
			plan() {
				const ops = [];
				let failedParse = false;
				const fields = /* @__PURE__ */ new Set([...this.clears, ...Object.keys(this.draft)]);
				for (const field of fields) {
					if (this.clears.has(field)) {
						ops.push({
							op: "unset",
							path: [field]
						});
						continue;
					}
					let next;
					if (field === "tripCodes") next = this.draft.tripCodes;
					else if (field === "fallbacks") {
						next = (this.draft.fallbacks ?? []).map((row) => ({
							provider: row.provider.trim(),
							model: row.model.trim()
						}));
						if (next.some((row) => row.provider === "" || row.model === "")) failedParse = true;
					} else if (NUMBER_FIELDS.includes(field)) {
						const staged = this.draft[field];
						const parsed = typeof staged === "number" ? staged : this.parseNumber(String(staged ?? ""));
						if (parsed === void 0) failedParse = true;
						next = parsed;
					} else next = this.draft[field];
					if (sameJson(next, this.current(field))) continue;
					ops.push({
						op: "set",
						path: [field],
						value: next
					});
				}
				return {
					ops,
					failedParse
				};
			}
			async save() {
				if (this.saving) return;
				const { ops, failedParse } = this.plan();
				if (ops.length === 0 || failedParse) return;
				this.saving = true;
				this.failed = false;
				this.saved = false;
				this.publish();
				const revision = this.draftRevision ?? this.scope.getSnapshot().revision;
				try {
					if (typeof this.scope.mutate === "function") await this.scope.mutate(ops, revision);
					else for (const op of ops) {
						const key = op.path[0];
						if (key === void 0) continue;
						if (op.op === "unset") await this.scope.unset(key);
						else await this.scope.set(key, op.value);
					}
				} catch {}
				const user = this.scope.getSnapshot().user ?? {};
				const landed = ops.every((op) => {
					const key = op.path[0];
					if (key === void 0) return false;
					if (op.op === "unset") return !Object.hasOwn(user, key);
					return sameJson(user[key], op.value);
				});
				this.saving = false;
				if (landed) {
					this.draft = {};
					this.clears.clear();
					this.draftRevision = void 0;
					this.saved = true;
				} else this.failed = true;
				this.publish();
			}
		};
		/** Per-field row chrome: label, hint, "edited" badge, reset. */
		function FieldHead(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: FailoverContinueCard_module_css_default.label,
					children: props.label
				}),
				props.overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: FailoverContinueCard_module_css_default.reset,
					onClick: props.onReset,
					children: props.t("reset")
				}) : null,
				props.overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: FailoverContinueCard_module_css_default.badge,
					children: props.t("overridden")
				}) : null,
				props.hint !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: FailoverContinueCard_module_css_default.hint,
					children: props.hint
				}) : null
			] });
		}
		/**
		* Render the model-failover card in the Plugin configuration tab.
		* @param props - locale seat, the card store hook, and the draft actions.
		*/
		function FailoverContinueCard({ t, useCard, ...actions }) {
			const state = useCard((snapshot) => snapshot);
			const [open, setOpen] = (0, react.useState)(true);
			if (!state.available) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
				className: FailoverContinueCard_module_css_default.card,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: FailoverContinueCard_module_css_default.body,
					children: t("loading")
				})
			});
			const disabled = !state.writable || state.saving;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: FailoverContinueCard_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: FailoverContinueCard_module_css_default.head,
					onClick: () => setOpen((value) => !value),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: FailoverContinueCard_module_css_default.headText,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: FailoverContinueCard_module_css_default.name,
								children: t("title")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: FailoverContinueCard_module_css_default.description,
								children: t("description")
							})]
						}),
						state.dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: FailoverContinueCard_module_css_default.pending,
							children: t("unsaved")
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							"aria-hidden": true,
							children: open ? "▾" : "▸"
						})
					]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: FailoverContinueCard_module_css_default.body,
					children: [
						!state.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: FailoverContinueCard_module_css_default.readOnly,
							children: t("readOnly")
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: FailoverContinueCard_module_css_default.row,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: FailoverContinueCard_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: state.toggles.enabled.value,
									disabled,
									onChange: (event) => actions.toggle("enabled", event.target.checked)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: FailoverContinueCard_module_css_default.label,
									children: t("enabled")
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: FailoverContinueCard_module_css_default.hint,
								children: t("enabledHint")
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: FailoverContinueCard_module_css_default.row,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: FailoverContinueCard_module_css_default.label,
								children: [
									t("primaryRoute"),
									": ",
									state.primary
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: FailoverContinueCard_module_css_default.hint,
								children: t("primaryHint")
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: FailoverContinueCard_module_css_default.row,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FieldHead, {
									label: t("fallbacks"),
									hint: t("fallbacksHint"),
									overridden: state.fallbacksOverridden,
									onReset: () => actions.resetField("fallbacks"),
									t
								}),
								state.fallbacks.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: FailoverContinueCard_module_css_default.empty,
									children: t("empty")
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("datalist", {
									id: "fc-providers",
									children: state.providers.map((provider) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { value: provider }, provider))
								}),
								state.fallbacks.map((row, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: FailoverContinueCard_module_css_default.route,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: `${FailoverContinueCard_module_css_default.input} ${FailoverContinueCard_module_css_default.inputMono}`,
											placeholder: t("provider"),
											list: "fc-providers",
											value: row.provider,
											disabled,
											onChange: (event) => actions.editFallback(index, { provider: event.target.value })
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: `${FailoverContinueCard_module_css_default.input} ${FailoverContinueCard_module_css_default.inputMono}`,
											placeholder: t("model"),
											list: `fc-models-${row.provider}`,
											value: row.model,
											disabled,
											onChange: (event) => actions.editFallback(index, { model: event.target.value })
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("datalist", {
											id: `fc-models-${row.provider}`,
											children: (state.modelsOf[row.provider] ?? []).map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", { value: model }, model))
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: FailoverContinueCard_module_css_default.actions,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: FailoverContinueCard_module_css_default.button,
													disabled: disabled || index === 0,
													title: t("moveUp"),
													onClick: () => actions.moveFallback(index, -1),
													children: "↑"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: FailoverContinueCard_module_css_default.button,
													disabled: disabled || index === state.fallbacks.length - 1,
													title: t("moveDown"),
													onClick: () => actions.moveFallback(index, 1),
													children: "↓"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: FailoverContinueCard_module_css_default.button,
													disabled,
													title: t("remove"),
													onClick: () => actions.removeFallback(index),
													children: "✕"
												})
											]
										})
									]
								}, index)),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: FailoverContinueCard_module_css_default.button,
									disabled,
									onClick: actions.addFallback,
									children: ["+ ", t("addFallback")]
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: FailoverContinueCard_module_css_default.row,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FieldHead, {
								label: t("tripCodes"),
								hint: t("tripCodesHint"),
								overridden: state.tripCodesOverridden,
								onReset: () => actions.resetField("tripCodes"),
								t
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: `${FailoverContinueCard_module_css_default.input} ${FailoverContinueCard_module_css_default.inputWide} ${FailoverContinueCard_module_css_default.inputMono}`,
								value: state.tripCodes,
								disabled,
								onChange: (event) => actions.editTripCodes(event.target.value)
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: FailoverContinueCard_module_css_default.row,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: FailoverContinueCard_module_css_default.label,
								children: t("thresholds")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: FailoverContinueCard_module_css_default.grid,
								children: BREAKER_NUMBERS.map((field) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: FailoverContinueCard_module_css_default.gridItem,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
											t(field),
											state.numbers[field].overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: FailoverContinueCard_module_css_default.badge,
												children: [" ", t("overridden")]
											}) : null,
											state.numbers[field].overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: FailoverContinueCard_module_css_default.reset,
												onClick: () => actions.resetField(field),
												children: [" ", t("reset")]
											}) : null
										] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "text",
											inputMode: "numeric",
											className: `${FailoverContinueCard_module_css_default.input} ${FailoverContinueCard_module_css_default.inputMono} ${state.numbers[field].invalid ? FailoverContinueCard_module_css_default.invalid : ""}`,
											value: state.numbers[field].text,
											disabled,
											onChange: (event) => actions.editNumber(field, event.target.value)
										}),
										state.numbers[field].invalid ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: FailoverContinueCard_module_css_default.invalidText,
											children: t("invalidNumber")
										}) : null
									]
								}, field))
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: FailoverContinueCard_module_css_default.row,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: FailoverContinueCard_module_css_default.label,
									children: t("continueSection")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: state.toggles.scanOnBoot.value,
									disabled,
									onChange: (event) => actions.toggle("scanOnBoot", event.target.checked)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: FailoverContinueCard_module_css_default.label,
									children: [" ", t("scanOnBoot")]
								})] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: state.toggles.classify.value,
									disabled,
									onChange: (event) => actions.toggle("classify", event.target.checked)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: FailoverContinueCard_module_css_default.label,
									children: [" ", t("classify")]
								})] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: state.toggles.notify.value,
									disabled,
									onChange: (event) => actions.toggle("notify", event.target.checked)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: FailoverContinueCard_module_css_default.label,
									children: [" ", t("notify")]
								})] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: state.toggles.paused.value,
									disabled,
									onChange: (event) => actions.toggle("paused", event.target.checked)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: FailoverContinueCard_module_css_default.label,
									children: [" ", t("paused")]
								})] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: state.toggles.loopGuard.value,
									disabled,
									onChange: (event) => actions.toggle("loopGuard", event.target.checked)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: FailoverContinueCard_module_css_default.label,
									children: [" ", t("loopGuard")]
								})] })
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: FailoverContinueCard_module_css_default.row,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FieldHead, {
								label: t("continueText"),
								hint: t("continueTextHint"),
								overridden: state.continueTextOverridden,
								onReset: () => actions.resetField("continueText"),
								t
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: `${FailoverContinueCard_module_css_default.input} ${FailoverContinueCard_module_css_default.inputWide}`,
								value: state.continueText,
								disabled,
								onChange: (event) => actions.editText("continueText", event.target.value)
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: FailoverContinueCard_module_css_default.row,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FieldHead, {
								label: t("retryableErrorPatterns"),
								hint: t("retryableErrorPatternsHint"),
								overridden: state.retryableErrorPatternsOverridden,
								onReset: () => actions.resetField("retryableErrorPatterns"),
								t
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: `${FailoverContinueCard_module_css_default.input} ${FailoverContinueCard_module_css_default.inputWide} ${FailoverContinueCard_module_css_default.inputMono}`,
								value: state.retryableErrorPatterns,
								disabled,
								onChange: (event) => actions.editText("retryableErrorPatterns", event.target.value)
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: FailoverContinueCard_module_css_default.row,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: FailoverContinueCard_module_css_default.label,
								children: t("continueNumbers")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: FailoverContinueCard_module_css_default.grid,
								children: CONTINUE_NUMBERS.map((field) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: FailoverContinueCard_module_css_default.gridItem,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
											t(field),
											state.numbers[field].overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: FailoverContinueCard_module_css_default.badge,
												children: [" ", t("overridden")]
											}) : null,
											state.numbers[field].overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: FailoverContinueCard_module_css_default.reset,
												onClick: () => actions.resetField(field),
												children: [" ", t("reset")]
											}) : null
										] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "text",
											inputMode: "numeric",
											className: `${FailoverContinueCard_module_css_default.input} ${FailoverContinueCard_module_css_default.inputMono} ${state.numbers[field].invalid ? FailoverContinueCard_module_css_default.invalid : ""}`,
											value: state.numbers[field].text,
											disabled,
											onChange: (event) => actions.editNumber(field, event.target.value)
										}),
										state.numbers[field].invalid ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: FailoverContinueCard_module_css_default.invalidText,
											children: t("invalidNumber")
										}) : null
									]
								}, field))
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: FailoverContinueCard_module_css_default.footNote,
							children: t("liveNotice")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: FailoverContinueCard_module_css_default.footer,
							children: [
								state.failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: FailoverContinueCard_module_css_default.statusErr,
									role: "alert",
									children: t("saveFailed")
								}) : null,
								state.saved ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: FailoverContinueCard_module_css_default.statusOk,
									role: "status",
									children: t("saved")
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: FailoverContinueCard_module_css_default.button,
									disabled: !state.dirty || state.saving,
									onClick: actions.discard,
									children: t("discard")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: `${FailoverContinueCard_module_css_default.button} ${FailoverContinueCard_module_css_default.primary}`,
									disabled: !state.dirty || state.invalid || state.saving || !state.writable,
									onClick: actions.save,
									children: state.saving ? t("saving") : t("save")
								})
							]
						})
					]
				}) : null]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		const en = {
			title: "Failover + auto-continue",
			description: "Ordered fallback chain with circuit breaking plus automatic continuation of failed turns. The next request leaves the dead route; the turn continues by itself.",
			loading: "Loading settings…",
			unavailable: "This host does not serve the failover-continue settings namespace.",
			readOnly: "This deployment serves the settings document read-only.",
			enabled: "Enabled",
			enabledHint: "Master switch. When off, failures are neither switched nor continued.",
			primaryRoute: "Current primary",
			primaryHint: "The session default model. Fallbacks below are only consulted when its circuit is open.",
			fallbacks: "Fallback routes (ordered)",
			fallbacksHint: "First healthy route wins. Provider/model values are suggested from the configured model catalog; any reachable route is allowed.",
			provider: "Provider",
			model: "Model",
			addFallback: "Add fallback",
			remove: "Remove",
			moveUp: "Move up",
			moveDown: "Move down",
			empty: "No fallback routes configured — failures are recorded but never switched.",
			tripCodes: "Trip codes",
			tripCodesHint: "Comma-separated failure codes that open a circuit and allow continuing (e.g. RATE_LIMIT, SERVER, TIMEOUT, AUTH, BILLING, QUOTA). AUTH/BILLING switch the route instead of killing the session.",
			thresholds: "Breaker thresholds",
			modelCircuitThreshold: "Model failures to open",
			modelCooldownMs: "Model cooldown (ms)",
			platformCircuitThreshold: "Open models to trip provider",
			platformCooldownMs: "Provider cooldown (ms)",
			burstWindowMs: "Burst window (ms)",
			maxSwitchesPerStep: "Max switches per step",
			continueSection: "Auto-continue",
			continueText: "Continue text",
			continueTextHint: "Message injected when a failed turn resumes. Placeholders: {code} {message} {status} {tool} {turn} {errorCount}.",
			retryableErrorPatterns: "Extra retryable patterns",
			retryableErrorPatternsHint: "One literal per line: message/code fragments that always count as retryable and take precedence over the built-in classification.",
			continueNumbers: "Continue timing",
			graceMs: "Grace before resend (ms)",
			cooldownMs: "Min interval between continues (ms)",
			maxConsecutive: "Max consecutive continues",
			scanOnBoot: "Scan interrupted sessions on boot",
			scanLimit: "Sessions per scan",
			freshMs: "Interruption freshness window (ms)",
			classify: "Skip permanent failures",
			backoffFactor: "Backoff multiplier",
			backoffMaxMs: "Backoff cap (ms)",
			notify: "Browser notifications",
			paused: "Pause auto-continue",
			loopGuard: "Loop guard",
			loopShortChars: "Short message chars",
			loopWindowMs: "Loop window (ms)",
			loopShortCount: "Short messages to trip",
			loopRepeatText: "Repeated texts to trip",
			loopToolRepeat: "Repeated tool calls to trip",
			overridden: "edited",
			reset: "Reset",
			unsaved: "unsaved",
			save: "Save",
			saving: "Saving…",
			saved: "Saved — applied immediately (circuits reset).",
			discard: "Discard",
			invalidNumber: "Not a valid number",
			saveFailed: "Save failed. The draft was kept for correction.",
			liveNotice: "A save applies immediately; open circuits reset. Custom session event types are never written, so logs stay loadable."
		};
		const ru = {
			title: "Фолбэк + автопродолжение",
			description: "Упорядоченная цепочка резервов с предохранителем плюс автопродолжение упавших тернов. Следующий запрос уходит с мёртвого маршрута, терн продолжается сам.",
			loading: "Загрузка настроек…",
			unavailable: "Хост не отдаёт неймспейс настроек failover-continue.",
			readOnly: "Настройки в этом окружении только для чтения.",
			enabled: "Включено",
			enabledHint: "Главный рубильник. Выключено — ни переключений, ни продолжений.",
			primaryRoute: "Текущий primary",
			primaryHint: "Дефолтная модель сессии. Резервы ниже используются, только когда её цепь открыта.",
			fallbacks: "Резервные маршруты (по порядку)",
			fallbacksHint: "Выигрывает первый здоровый. Значения подсказываются из каталога моделей; подойдёт любой достижимый маршрут.",
			provider: "Провайдер",
			model: "Модель",
			addFallback: "Добавить резерв",
			remove: "Убрать",
			moveUp: "Выше",
			moveDown: "Ниже",
			empty: "Резервы не заданы — падения только фиксируются, переключений нет.",
			tripCodes: "Коды срабатывания",
			tripCodesHint: "Коды ошибок через запятую, открывающие цепь и разрешающие продолжение (например RATE_LIMIT, SERVER, TIMEOUT, AUTH, BILLING, QUOTA). AUTH/BILLING переключают маршрут, а не хоронят сессию.",
			thresholds: "Пороги предохранителя",
			modelCircuitThreshold: "Падений до размыкания",
			modelCooldownMs: "Остывание маршрута (мс)",
			platformCircuitThreshold: "Открытых моделей до бана провайдера",
			platformCooldownMs: "Остывание провайдера (мс)",
			burstWindowMs: "Окно серии (мс)",
			maxSwitchesPerStep: "Макс. переключений за шаг",
			continueSection: "Автопродолжение",
			continueText: "Текст продолжения",
			continueTextHint: "Сообщение, отправляемое при возобновлении упавшего терна. Плейсхолдеры: {code} {message} {status} {tool} {turn} {errorCount}.",
			retryableErrorPatterns: "Свои ретраимые паттерны",
			retryableErrorPatternsHint: "По одному литералу на строку: фрагменты сообщений/кодов, которые всегда считаются ретраимыми и старше встроенной классификации.",
			continueNumbers: "Тайминги продолжения",
			graceMs: "Пауза перед отправкой (мс)",
			cooldownMs: "Мин. интервал между продолжениями (мс)",
			maxConsecutive: "Макс. продолжений подряд",
			scanOnBoot: "Сканировать оборванные при старте",
			scanLimit: "Сессий за один скан",
			freshMs: "Окно свежести обрыва (мс)",
			classify: "Пропускать постоянные ошибки",
			backoffFactor: "Множитель бэкоффа",
			backoffMaxMs: "Потолок бэкоффа (мс)",
			notify: "Уведомления браузера",
			paused: "Пауза автопродолжения",
			loopGuard: "Сторож зацикливаний",
			loopShortChars: "Символов «короткого» сообщения",
			loopWindowMs: "Окно зацикливания (мс)",
			loopShortCount: "Коротких подряд до сработки",
			loopRepeatText: "Повторов текста до сработки",
			loopToolRepeat: "Повторов tool-вызовов до сработки",
			overridden: "изменено",
			reset: "Сбросить",
			unsaved: "не сохранено",
			save: "Сохранить",
			saving: "Сохранение…",
			saved: "Сохранено — применено сразу (цепи сброшены).",
			discard: "Отменить",
			invalidNumber: "Не число",
			saveFailed: "Не сохранилось, черновик оставлен для правки.",
			liveNotice: "Сохранение применяется сразу; открытые цепи сбрасываются. Свои типы событий в лог не пишутся — сессии остаются открываемыми."
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "settings.dshFailoverContinue";
		/** Settings namespace the host half serves; the card is dispatched by this key. */
		const SETTINGS_NS = "failover-continue";
		/** Read-only catalog scope: provider/model suggestions for fallback rows. */
		const CATALOG_NS = "llm-pi-ai";
		/** Read-only scope naming the session's starting route. */
		const PRIMARY_NS = "agent-default-model";
		/** Services required by this browser plugin. */
		const inject = [
			"slots",
			"locale",
			"settingsScope"
		];
		/**
		* Register the unified card under Settings → Plugins.
		* @param ctx - the browser plugin context.
		*/
		function apply(ctx) {
			try {
				ctx.locale.addLanguage?.({
					id: "ru",
					label: "Русский",
					fallback: "en"
				});
			} catch {}
			ctx.effect(() => ctx.locale.register(NS, {
				ru,
				en
			}), "dsh-failover-continue: dictionaries");
			const model = new FailoverContinueCardModel(ctx.settingsScope.bind({ namespace: SETTINGS_NS }), ctx.settingsScope.bind({ namespace: CATALOG_NS }), ctx.settingsScope.bind({ namespace: PRIMARY_NS }));
			const actions = {
				toggle: (field, value) => model.toggle(field, value),
				editNumber: (field, text) => model.editNumber(field, text),
				editText: (field, text) => model.editText(field, text),
				editFallback: (index, patch) => model.editFallback(index, patch),
				addFallback: () => model.addFallback(),
				removeFallback: (index) => model.removeFallback(index),
				moveFallback: (index, delta) => model.moveFallback(index, delta),
				editTripCodes: (text) => model.editTripCodes(text),
				resetField: (field) => model.resetField(field),
				save: () => void model.save(),
				discard: () => model.discard()
			};
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				key: SETTINGS_NS,
				locale: NS,
				inject: () => ({
					hooks: { card: model.store },
					...actions
				})
			}, FailoverContinueCard));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map