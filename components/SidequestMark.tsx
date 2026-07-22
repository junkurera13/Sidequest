import Image from "next/image";
import styles from "./SidequestMark.module.css";

type SidequestMarkProps = {
  className?: string;
  label?: string;
};

export function SidequestMark({ className, label }: SidequestMarkProps) {
  return (
    <span
      className={`${styles.crop}${className ? ` ${className}` : ""}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Image
        className={styles.image}
        src="/sidequest-mark.svg"
        alt=""
        width={108}
        height={108}
        priority
      />
    </span>
  );
}
