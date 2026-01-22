"use client";

import { useState } from "react";
import { X } from "lucide-react";
import styles from "./tag-input.module.css";

export interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder: string;
  suggestions?: string[];
  id?: string;
}

export function TagInput({
  tags,
  onTagsChange,
  placeholder,
  suggestions,
  id,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
    }
    setInputValue("");
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const datalistId = id ? `${id}-suggestions` : "tag-suggestions";

  return (
    <div className={styles.tagInput}>
      {tags.map((tag) => (
        <span key={tag} className={styles.tag}>
          {tag}
          <button
            type="button"
            className={styles.tagRemove}
            onClick={() => removeTag(tag)}
            aria-label={`Remove ${tag}`}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        type="text"
        id={id}
        className={styles.tagInputField}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => inputValue && addTag(inputValue)}
        placeholder={tags.length === 0 ? placeholder : ""}
        list={suggestions ? datalistId : undefined}
      />
      {suggestions && (
        <datalist id={datalistId}>
          {suggestions
            .filter((s) => !tags.includes(s))
            .map((s) => (
              <option key={s} value={s} />
            ))}
        </datalist>
      )}
    </div>
  );
}
